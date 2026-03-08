"use client";

import { useRouter } from "next/navigation";
import {
  type ClipboardEvent,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type CollaborationSheetChangeSet,
  useCollaborationRoom,
} from "@/features/collaboration/use-collaboration-room";
import { useFormulaEngine } from "@/features/formulas/use-formula-engine";
import { createCellKey, parseCellKey } from "@/features/spreadsheet/addressing";
import { getResolvedHorizontalAlign } from "@/features/spreadsheet/cell-formatting";
import {
  createDelimitedExport,
  createJsonExport,
} from "@/features/spreadsheet/export";
import {
  createCellSelection,
  createRangeSelection,
  getNavigationDelta,
  getSelectionAnchor,
  getSelectionDimensionsForLayout,
  getSelectionMembers,
  getSelectionRect,
  getWriteStateAfterEvent,
  moveCellAddressInLayout,
  parseClipboardMatrix,
  serializeSelectionMatrix,
} from "@/features/spreadsheet/interaction";
import {
  clampColumnWidth,
  clampRowHeight,
  createAxisLayouts,
  getAxisLayoutByLogicalIndex,
  getAxisVisibleSlice,
} from "@/features/spreadsheet/sheet-layout";
import { SparseSheet } from "@/features/spreadsheet/sparse-sheet";
import {
  DEFAULT_VIEWPORT_HEIGHT,
  DEFAULT_VIEWPORT_WIDTH,
  useVirtualViewport,
} from "@/features/spreadsheet/use-virtual-viewport";
import {
  DEFAULT_SHEET_METRICS,
  getCellAddressFromPoint,
  getCellLayout,
  getColumnHeaderLabel,
  getGridDimensions,
} from "@/features/spreadsheet/viewport";
import {
  applyRemoteChanges,
  captureLayoutState,
  commitHeaderDrag,
  createSeededSheet,
  downloadExport,
  formatWriteState,
  getCellDisplayValue,
  getCellKind,
  getFontFamilyLabel,
  getHeaderBackgroundColor,
  getHelpPanelTitle,
  getSelectionMatrix,
  getSnapshotChanges,
  getToolbarButtonClassName,
  hasSnapshotChanges,
  sanitizeFileName,
} from "@/features/spreadsheet/virtualized-sheet-helpers";
import {
  handleFormatAndInsertShortcuts,
  handleInsertShortcuts,
  handleMetaShortcuts,
  handleNavigationShortcuts,
  handleViewShortcuts,
  type ShortcutHandlerArgs,
} from "@/features/spreadsheet/virtualized-sheet-shortcuts";
import type {
  EditorSurface,
  HeaderDragState,
  HelpPanel,
  HistoryState,
  KeyedChange,
  MenuKey,
  SnapshotChanges,
} from "@/features/spreadsheet/virtualized-sheet-types";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  createShortcutLabel,
  FillColorIcon,
  FontFamilyIcon,
  FontSizeIcon,
  MenuButton,
  MenuItem,
  TextColorIcon,
  VirtualCell,
} from "@/features/spreadsheet/virtualized-sheet-ui";
import { renameDocument, touchDocument } from "@/lib/metadata/metadata-store";
import type { CollaborationPresenceSnapshot } from "@/types/collaboration";
import type { DocumentMeta, SessionIdentity } from "@/types/metadata";
import type {
  CellAddress,
  CellFontFamily,
  CellFontSize,
  CellFormat,
  CellFormatRecord,
  CellRecord,
  Selection,
} from "@/types/spreadsheet";
import { CELL_FONT_FAMILIES, CELL_FONT_SIZES } from "@/types/spreadsheet";
import type { EditorMode, WriteState } from "@/types/ui";
import type { SparseSheetSnapshot } from "./sparse-sheet";

const DEFAULT_SELECTION: CellAddress = {
  col: 1,
  row: 1,
};
const RECONNECT_SETTLE_DELAY_MS = 220;
const WRITE_CONFIRMATION_DELAY_MS = 180;
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the editor composes menu actions, virtualization, and collaboration in one client boundary.
export function VirtualizedSheet({
  document,
  onCollaborationSnapshotChange,
  onDocumentUpdated,
  onWriteStateChange,
  session,
}: {
  document: DocumentMeta;
  onCollaborationSnapshotChange?: (
    snapshot: CollaborationPresenceSnapshot
  ) => void;
  onDocumentUpdated?: Dispatch<SetStateAction<DocumentMeta | null>>;
  onWriteStateChange?: (writeState: WriteState) => void;
  session: SessionIdentity | null;
}) {
  const router = useRouter();
  const sheetRef = useRef<SparseSheet | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formulaBarRef = useRef<HTMLInputElement | null>(null);
  const keyboardProxyRef = useRef<HTMLTextAreaElement | null>(null);
  const pointerAnchorRef = useRef<CellAddress | null>(null);
  const clipboardTextRef = useRef("");
  const isPointerSelectingRef = useRef(false);
  const commitTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const writeStateRef = useRef<WriteState>("idle");
  const historyRef = useRef<{
    future: HistoryState[];
    past: HistoryState[];
  }>({
    future: [],
    past: [],
  });
  const [, setCellRevision] = useState(0);
  const [selection, setSelection] = useState<Selection>(() =>
    createCellSelection(DEFAULT_SELECTION)
  );
  const [, setEditorMode] = useState<EditorMode>("view");
  const [editingAddress, setEditingAddress] = useState<CellAddress | null>(
    null
  );
  const [editingSurface, setEditingSurface] = useState<EditorSurface | null>(
    null
  );
  const [draftValue, setDraftValue] = useState("");
  const [writeState, setWriteState] = useState<WriteState>("idle");
  const [headerDragState, setHeaderDragState] =
    useState<HeaderDragState | null>(null);
  const [activeMenu, setActiveMenu] = useState<MenuKey | null>(null);
  const [activeHelpPanel, setActiveHelpPanel] = useState<HelpPanel | null>(
    null
  );
  const [showFormulaBar, setShowFormulaBar] = useState(true);
  const [showGridlines, setShowGridlines] = useState(true);
  const [showCrosshairHighlight, setShowCrosshairHighlight] = useState(true);
  const [freezeTopRow, setFreezeTopRow] = useState(false);
  const [freezeFirstColumn, setFreezeFirstColumn] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState(document.title);

  if (sheetRef.current === null) {
    sheetRef.current = new SparseSheet();
  }

  const sheet = sheetRef.current;
  const [layoutState, setLayoutState] = useState(() =>
    captureLayoutState(sheet)
  );
  const bounds = sheet.bounds;
  const { handleScroll, scrollRef, viewport } = useVirtualViewport();
  const activeCell =
    selection.type === "cell" ? selection.anchor : selection.end;
  const activeCellKey = createCellKey(activeCell);
  const activeCellRecord = sheet.getCell(activeCell);
  const activeCellRaw = getCellDisplayValue(activeCellRecord);
  const activeCellFormat = sheet.getCellFormat(activeCell);
  const activeFontFamily = activeCellFormat?.fontFamily ?? "";
  const activeFontSize = activeCellFormat?.fontSize
    ? String(activeCellFormat.fontSize)
    : "";
  const { columnLayout, rowLayout } = useMemo(
    () =>
      createAxisLayouts(
        bounds,
        DEFAULT_SHEET_METRICS,
        layoutState.columnOrder,
        layoutState.rowOrder,
        layoutState.columnWidths,
        layoutState.rowHeights
      ),
    [bounds, layoutState]
  );
  const { height: gridHeight, width: gridWidth } = getGridDimensions(
    columnLayout,
    rowLayout
  );
  const visibleColumnsSlice = useMemo(
    () =>
      getAxisVisibleSlice(
        columnLayout,
        viewport.scrollX,
        viewport.viewportWidth ?? DEFAULT_VIEWPORT_WIDTH,
        DEFAULT_SHEET_METRICS.overscan
      ),
    [columnLayout, viewport.scrollX, viewport.viewportWidth]
  );
  const visibleRowsSlice = useMemo(
    () =>
      getAxisVisibleSlice(
        rowLayout,
        viewport.scrollY,
        viewport.viewportHeight ?? DEFAULT_VIEWPORT_HEIGHT,
        DEFAULT_SHEET_METRICS.overscan
      ),
    [rowLayout, viewport.scrollY, viewport.viewportHeight]
  );
  const visibleColumns = visibleColumnsSlice.items;
  const visibleRows = visibleRowsSlice.items;
  const selectionMembers = useMemo(
    () => getSelectionMembers(selection, columnLayout, rowLayout),
    [columnLayout, rowLayout, selection]
  );
  const selectionRect = useMemo(
    () => getSelectionRect(selection, columnLayout, rowLayout),
    [columnLayout, rowLayout, selection]
  );
  const selectionDimensions = useMemo(
    () => getSelectionDimensionsForLayout(selection, columnLayout, rowLayout),
    [columnLayout, rowLayout, selection]
  );
  const activeCellLayout = getCellLayout(activeCell, columnLayout, rowLayout);
  const selectedColumnSet = useMemo(
    () => new Set(selectionMembers.columns),
    [selectionMembers.columns]
  );
  const selectedRowSet = useMemo(
    () => new Set(selectionMembers.rows),
    [selectionMembers.rows]
  );
  const seededSheetSnapshot = useMemo(
    () => createSeededSheet(document).snapshot(),
    [document]
  );
  const initialSeedCells = useMemo(
    () =>
      Array.from(seededSheetSnapshot.cells, ([key, value]) => ({
        key,
        raw: value.raw,
      })),
    [seededSheetSnapshot]
  );
  const initialFormulaCells = useMemo(
    () =>
      initialSeedCells.map(({ key, raw }) => ({
        key,
        raw,
      })),
    [initialSeedCells]
  );
  const visibleKeys = useMemo(
    () =>
      visibleRows.flatMap((row) =>
        visibleColumns.map((column) => createCellKey({ col: column, row }))
      ),
    [visibleColumns, visibleRows]
  );
  const {
    batchUpsert,
    computedValues,
    deleteCell,
    formulaErrors,
    isReady,
    upsertCell: upsertFormulaCell,
  } = useFormulaEngine({
    bounds,
    initialCells: initialFormulaCells,
    visibleKeys,
  });
  const activeFormulaError = formulaErrors.get(activeCellKey);
  const activeComputedValue = computedValues.get(activeCellKey);
  const activeCellAlignment = getResolvedHorizontalAlign({
    cell: activeCellRecord,
    computedValue: activeComputedValue,
    format: activeCellFormat,
    formulaError: activeFormulaError,
  });
  const syncDocumentTimestamp = () => {
    touchDocument(document.id).catch(() => undefined);
  };
  const setCellRevisionWithTransition = () => {
    startTransition(() => {
      setCellRevision((current) => current + 1);
    });
  };
  const setLayoutRevisionWithTransition = () => {
    startTransition(() => {
      setLayoutState(captureLayoutState(sheetRef.current as SparseSheet));
    });
  };
  const handleCollaborativeSheetChanges = useEffectEvent(
    (changes: CollaborationSheetChangeSet) => {
      const sheetModel = sheetRef.current;

      if (!sheetModel) {
        return;
      }
      applyRemoteChanges({
        batchUpsert,
        changes,
        deleteCell,
        markCellsDirty: setCellRevisionWithTransition,
        markLayoutDirty: setLayoutRevisionWithTransition,
        sheet: sheetModel,
      });
    }
  );
  const {
    batchFormat,
    batchUpsert: syncBatchUpsert,
    lastRemoteLatencyMs,
    peers,
    setColumnOrder,
    setColumnWidth,
    setRowHeight,
    setRowOrder,
    status,
    upsertCell: syncUpsertCell,
  } = useCollaborationRoom({
    initialCells: initialSeedCells,
    onSheetChanged: handleCollaborativeSheetChanges,
    roomId: document.roomId,
    selection,
    session,
  });

  useEffect(() => {
    onCollaborationSnapshotChange?.({
      activeCell: activeCellKey,
      lastRemoteLatencyMs,
      peers,
      status,
    });
  }, [
    activeCellKey,
    lastRemoteLatencyMs,
    onCollaborationSnapshotChange,
    peers,
    status,
  ]);

  const closeMenus = () => {
    setActiveMenu(null);
  };
  const pushHistoryState = (entry: HistoryState) => {
    const nextPast = [...historyRef.current.past, entry].slice(-40);

    historyRef.current = {
      future: [],
      past: nextPast,
    };
  };
  const runTrackedMutation = (mutation: () => void) => {
    const beforeState: HistoryState = {
      selection,
      snapshot: sheet.snapshot(),
    };

    mutation();

    const afterSnapshot = sheetRef.current?.snapshot();

    if (!afterSnapshot) {
      return;
    }

    const changes = getSnapshotChanges(beforeState.snapshot, afterSnapshot);

    if (hasSnapshotChanges(changes, beforeState.snapshot, afterSnapshot)) {
      pushHistoryState(beforeState);
    }
  };
  const commitTrackedSheetMutation = (args: {
    mutation: () => void;
    nextSelection?: Selection;
  }) => {
    const beforeState: HistoryState = {
      selection,
      snapshot: sheet.snapshot(),
    };

    args.mutation();

    const afterSnapshot = sheet.snapshot();
    const changes = getSnapshotChanges(beforeState.snapshot, afterSnapshot);

    if (!hasSnapshotChanges(changes, beforeState.snapshot, afterSnapshot)) {
      if (args.nextSelection) {
        applySelection(args.nextSelection);
      }

      return;
    }

    pushHistoryState(beforeState);
    syncSnapshotChanges(changes, afterSnapshot);
    setCellRevisionWithTransition();
    setLayoutRevisionWithTransition();

    if (args.nextSelection) {
      applySelection(args.nextSelection);
    }
  };
  const syncCellSnapshotChanges = (cellChanges: KeyedChange<CellRecord>[]) => {
    const nextCellWrites = cellChanges.map((change) => ({
      key: change.key,
      raw: change.value?.raw ?? "",
    }));

    if (nextCellWrites.length === 0) {
      return false;
    }

    syncBatchUpsert(nextCellWrites);

    const formulaWrites = nextCellWrites.filter(
      (entry) => entry.raw.trim() !== ""
    );

    if (formulaWrites.length > 0) {
      batchUpsert(formulaWrites);
    }

    for (const entry of nextCellWrites) {
      if (entry.raw.trim() === "") {
        deleteCell(entry.key);
      }
    }

    return true;
  };
  const syncFormatSnapshotChanges = (
    formatChanges: KeyedChange<CellFormatRecord>[]
  ) => {
    if (formatChanges.length === 0) {
      return false;
    }

    batchFormat(
      formatChanges.map((change) => ({
        format: change.value,
        key: change.key,
      }))
    );

    return true;
  };
  const syncMetricSnapshotChanges = (
    changes: SnapshotChanges,
    next: SparseSheetSnapshot
  ) => {
    for (const change of changes.columnWidths) {
      setColumnWidth(change.index, change.value);
    }

    for (const change of changes.rowHeights) {
      setRowHeight(change.index, change.value);
    }

    if (changes.columnOrderChanged) {
      setColumnOrder(next.columnOrder);
    }

    if (changes.rowOrderChanged) {
      setRowOrder(next.rowOrder);
    }

    return (
      changes.columnWidths.length > 0 ||
      changes.rowHeights.length > 0 ||
      changes.columnOrderChanged ||
      changes.rowOrderChanged
    );
  };
  const syncSnapshotChanges = (
    changes: SnapshotChanges,
    next: SparseSheetSnapshot
  ) => {
    const didSyncCells = syncCellSnapshotChanges(changes.cells);
    const didSyncFormats = syncFormatSnapshotChanges(changes.formats);
    const didSyncMetrics = syncMetricSnapshotChanges(changes, next);

    if (didSyncCells || didSyncFormats || didSyncMetrics) {
      scheduleWriteConfirmation();
      syncDocumentTimestamp();
    }
  };
  const restoreHistoryState = (historyState: HistoryState) => {
    const beforeSnapshot = sheet.snapshot();
    const changes = getSnapshotChanges(beforeSnapshot, historyState.snapshot);

    if (!hasSnapshotChanges(changes, beforeSnapshot, historyState.snapshot)) {
      applySelection(historyState.selection);
      return;
    }

    sheet.restore(historyState.snapshot);
    syncSnapshotChanges(changes, historyState.snapshot);
    setCellRevisionWithTransition();
    setLayoutRevisionWithTransition();
    applySelection(historyState.selection);
  };

  const applyOptimisticCellWrite = (address: CellAddress, raw: string) => {
    const key = createCellKey(address);

    if (raw.trim() === "") {
      const changed = sheet.clearCell(address);

      if (changed) {
        deleteCell(key);
        setCellRevisionWithTransition();
      }

      return;
    }

    sheet.setCellByKey(key, {
      kind: getCellKind(raw),
      raw,
    });
    upsertFormulaCell({
      key,
      raw,
    });
    setCellRevisionWithTransition();
  };

  const applyOptimisticBatchWrite = (
    cells: Array<{
      key: string;
      raw: string;
    }>
  ) => {
    if (cells.length === 0) {
      return;
    }

    const formulaUpserts: Array<{ key: string; raw: string }> = [];
    let didChange = false;

    for (const cell of cells) {
      if (cell.raw.trim() === "") {
        didChange = sheet.clearCellByKey(cell.key) || didChange;
        deleteCell(cell.key);
        continue;
      }

      sheet.setCellByKey(cell.key, {
        kind: getCellKind(cell.raw),
        raw: cell.raw,
      });
      formulaUpserts.push(cell);
      didChange = true;
    }

    if (formulaUpserts.length > 0) {
      batchUpsert(formulaUpserts);
    }

    if (didChange) {
      setCellRevisionWithTransition();
    }
  };

  const applyFormattingPatch = (patch: CellFormat) => {
    runTrackedMutation(() => {
      const formatChanges = selectionMembers.rows.flatMap((row) =>
        selectionMembers.columns.map((col) => {
          const key = createCellKey({ col, row });
          const nextFormat = sheet.patchCellFormat({ col, row }, patch);

          return {
            format: nextFormat,
            key,
          };
        })
      );

      if (formatChanges.length === 0) {
        return;
      }

      setCellRevisionWithTransition();
      batchFormat(formatChanges);
      scheduleWriteConfirmation();
      syncDocumentTimestamp();
    });
  };

  const applyColumnWidth = (column: number, width: number, sync = false) => {
    const nextWidth = clampColumnWidth(width);
    sheet.setColumnWidth(column, nextWidth);
    setLayoutRevisionWithTransition();

    if (sync) {
      setColumnWidth(column, nextWidth);
      scheduleWriteConfirmation();
      syncDocumentTimestamp();
    }
  };

  const applyRowHeight = (row: number, height: number, sync = false) => {
    const nextHeight = clampRowHeight(height);
    sheet.setRowHeight(row, nextHeight);
    setLayoutRevisionWithTransition();

    if (sync) {
      setRowHeight(row, nextHeight);
      scheduleWriteConfirmation();
      syncDocumentTimestamp();
    }
  };

  const applyColumnOrder = (order: number[], sync = false) => {
    sheet.setColumnOrder(order);
    setLayoutRevisionWithTransition();

    if (sync) {
      setColumnOrder(order);
      scheduleWriteConfirmation();
      syncDocumentTimestamp();
    }
  };

  const applyRowOrder = (order: number[], sync = false) => {
    sheet.setRowOrder(order);
    setLayoutRevisionWithTransition();

    if (sync) {
      setRowOrder(order);
      scheduleWriteConfirmation();
      syncDocumentTimestamp();
    }
  };

  const setNextWriteState = (nextWriteState: WriteState) => {
    writeStateRef.current = nextWriteState;
    setWriteState(nextWriteState);
    onWriteStateChange?.(nextWriteState);
  };

  const emitWriteEvent = (
    event:
      | "flush-confirmed"
      | "flush-queued"
      | "network-offline"
      | "network-online"
  ) => {
    setNextWriteState(getWriteStateAfterEvent(writeStateRef.current, event));
  };

  const scheduleWriteConfirmation = () => {
    emitWriteEvent("flush-queued");

    if (typeof window === "undefined") {
      return;
    }

    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
    }

    commitTimerRef.current = window.setTimeout(() => {
      commitTimerRef.current = null;
      emitWriteEvent("flush-confirmed");
    }, WRITE_CONFIRMATION_DELAY_MS);
  };

  const ensureCellVisible = (address: CellAddress) => {
    const node = scrollRef.current;

    if (!node) {
      return;
    }

    const layout = getCellLayout(address, columnLayout, rowLayout);
    const cellRight = layout.left + layout.width;
    const cellBottom = layout.top + layout.height;

    if (layout.left < node.scrollLeft) {
      node.scrollLeft = layout.left;
    } else if (cellRight > node.scrollLeft + node.clientWidth) {
      node.scrollLeft = cellRight - node.clientWidth;
    }

    if (layout.top < node.scrollTop) {
      node.scrollTop = layout.top;
    } else if (cellBottom > node.scrollTop + node.clientHeight) {
      node.scrollTop = cellBottom - node.clientHeight;
    }
  };

  const applySelection = (nextSelection: Selection) => {
    setSelection(nextSelection);
    ensureCellVisible(
      nextSelection.type === "cell" ? nextSelection.anchor : nextSelection.end
    );
  };

  const writeCell = (address: CellAddress, value: string) => {
    runTrackedMutation(() => {
      const key = createCellKey(address);

      applyOptimisticCellWrite(address, value);
      syncUpsertCell({
        key,
        raw: value,
      });
      scheduleWriteConfirmation();
      syncDocumentTimestamp();
    });
  };

  const clearSelectionContents = () => {
    runTrackedMutation(() => {
      const clearedKeys = selectionMembers.rows.flatMap((row) =>
        selectionMembers.columns.map((col) => ({
          key: createCellKey({ col, row }),
          raw: "",
        }))
      );

      if (clearedKeys.length === 0) {
        return;
      }

      applyOptimisticBatchWrite(clearedKeys);
      syncBatchUpsert(clearedKeys);
      scheduleWriteConfirmation();
      syncDocumentTimestamp();
    });
  };

  const startEditing = (
    address: CellAddress,
    initialValue?: string,
    surface: EditorSurface = "cell"
  ) => {
    const nextValue =
      initialValue ?? getCellDisplayValue(sheet.getCell(address));
    setEditingAddress(address);
    setEditingSurface(surface);
    setDraftValue(nextValue);
    setEditorMode(nextValue.startsWith("=") ? "formula" : "edit");

    if (surface === "cell") {
      applySelection(createCellSelection(address));
    }
  };

  const stopEditing = () => {
    setEditingAddress(null);
    setEditingSurface(null);
    setDraftValue("");
    setEditorMode("view");
    keyboardProxyRef.current?.focus();
  };

  const commitEditing = (options?: { nextSelection?: Selection }) => {
    if (!editingAddress) {
      return;
    }

    writeCell(editingAddress, draftValue);
    const nextSelection =
      options?.nextSelection ?? createCellSelection(editingAddress);
    stopEditing();
    applySelection(nextSelection);
  };

  const handleExport = (format: "csv" | "json" | "tsv") => {
    const cells = sheet.getCells();
    const snapshot = sheet.snapshot();
    const usedColumns = new Set<number>();
    const usedRows = new Set<number>();

    for (const key of cells.keys()) {
      const address = parseCellKey(key);
      usedColumns.add(address.col);
      usedRows.add(address.row);
    }

    const columns = usedColumns.size
      ? snapshot.columnOrder.filter((column) => usedColumns.has(column))
      : [activeCell.col];
    const rows = usedRows.size
      ? snapshot.rowOrder.filter((row) => usedRows.has(row))
      : [activeCell.row];
    const matrix = getSelectionMatrix(sheet, columns, rows);
    const baseName = sanitizeFileName(document.title) || "sheet";

    if (format === "json") {
      downloadExport(
        `${baseName}.json`,
        createJsonExport({
          cells,
          columnOrder: snapshot.columnOrder,
          columnWidths: snapshot.columnWidths,
          formats: snapshot.formats,
          rowHeights: snapshot.rowHeights,
          rowOrder: snapshot.rowOrder,
        }),
        "application/json"
      );
      return;
    }

    downloadExport(
      `${baseName}.${format}`,
      createDelimitedExport(matrix, format === "csv" ? "," : "\t"),
      format === "csv" ? "text/csv" : "text/tab-separated-values"
    );
  };

  useEffect(() => {
    if (!editingAddress) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingAddress]);

  useEffect(() => {
    if (!(editingAddress && editingSurface === "formula-bar")) {
      return;
    }

    formulaBarRef.current?.focus();
    formulaBarRef.current?.select();
  }, [editingAddress, editingSurface]);

  useEffect(() => {
    onWriteStateChange?.("idle");
  }, [onWriteStateChange]);

  useEffect(() => {
    setRenameDraft(document.title);
  }, [document.title]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (
        target.closest("[data-menu-root]") ||
        target.closest("[data-dialog-root]")
      ) {
        return;
      }

      setActiveMenu(null);
    };

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveMenu(null);
        setActiveHelpPanel(null);
        setIsRenameDialogOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateWriteState = (nextWriteState: WriteState) => {
      writeStateRef.current = nextWriteState;
      setWriteState(nextWriteState);
      onWriteStateChange?.(nextWriteState);
    };

    const emitWindowWriteEvent = (
      event:
        | "flush-confirmed"
        | "flush-queued"
        | "network-offline"
        | "network-online"
    ) => {
      updateWriteState(getWriteStateAfterEvent(writeStateRef.current, event));
    };

    const handleOffline = () => {
      updateWriteState("offline");
    };

    const handleOnline = () => {
      emitWindowWriteEvent("network-online");

      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        updateWriteState(commitTimerRef.current === null ? "saved" : "saving");
      }, RECONNECT_SETTLE_DELAY_MS);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    if (!window.navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);

      if (commitTimerRef.current !== null) {
        window.clearTimeout(commitTimerRef.current);
      }

      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [onWriteStateChange]);

  const handleHeaderPointerMove = useEffectEvent(
    (event: globalThis.PointerEvent) => {
      if (!headerDragState) {
        return;
      }

      const node = scrollRef.current;

      if (!node) {
        return;
      }

      const rect = node.getBoundingClientRect();
      const pointerX = event.clientX - rect.left + node.scrollLeft;
      const pointerY = event.clientY - rect.top + node.scrollTop;

      if (headerDragState.type === "resize") {
        if (headerDragState.axis === "col") {
          const layout = getAxisLayoutByLogicalIndex(
            columnLayout,
            headerDragState.logicalIndex
          );

          applyColumnWidth(
            headerDragState.logicalIndex,
            pointerX - layout.start
          );
          return;
        }

        const layout = getAxisLayoutByLogicalIndex(
          rowLayout,
          headerDragState.logicalIndex
        );

        applyRowHeight(headerDragState.logicalIndex, pointerY - layout.start);
        return;
      }

      if (headerDragState.axis === "col") {
        const nextTarget = getCellAddressFromPoint(
          { x: pointerX, y: 0 },
          bounds,
          columnLayout,
          rowLayout
        ).col;

        setHeaderDragState((current) =>
          current?.type === "reorder" && current.axis === "col"
            ? {
                ...current,
                targetLogicalIndex: nextTarget,
              }
            : current
        );
        return;
      }

      const nextTarget = getCellAddressFromPoint(
        { x: 0, y: pointerY },
        bounds,
        columnLayout,
        rowLayout
      ).row;

      setHeaderDragState((current) =>
        current?.type === "reorder" && current.axis === "row"
          ? {
              ...current,
              targetLogicalIndex: nextTarget,
            }
          : current
      );
    }
  );

  const handleHeaderPointerUp = useEffectEvent(() => {
    if (!headerDragState) {
      return;
    }

    commitHeaderDrag({
      applyColumnOrder,
      applyRowOrder,
      headerDragState,
      scheduleWriteConfirmation,
      setColumnWidth,
      setRowHeight,
      sheet,
      syncDocumentTimestamp,
    });

    setHeaderDragState(null);
  });

  useEffect(() => {
    if (!headerDragState) {
      return;
    }

    window.addEventListener("pointermove", handleHeaderPointerMove);
    window.addEventListener("pointerup", handleHeaderPointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handleHeaderPointerMove);
      window.removeEventListener("pointerup", handleHeaderPointerUp);
    };
  }, [headerDragState]);

  const getAddressFromPointerEvent = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    const node = scrollRef.current;

    if (!node) {
      return null;
    }

    const rect = node.getBoundingClientRect();

    return getCellAddressFromPoint(
      {
        x: event.clientX - rect.left + node.scrollLeft,
        y: event.clientY - rect.top + node.scrollTop,
      },
      bounds,
      columnLayout,
      rowLayout
    );
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (editingAddress || headerDragState) {
      return;
    }

    const node = scrollRef.current;
    const nextAddress = getAddressFromPointerEvent(event);

    if (!(node && nextAddress)) {
      return;
    }

    event.preventDefault();
    keyboardProxyRef.current?.focus();
    isPointerSelectingRef.current = true;
    pointerAnchorRef.current = event.shiftKey
      ? getSelectionAnchor(selection)
      : nextAddress;
    applySelection(
      event.shiftKey
        ? createRangeSelection(getSelectionAnchor(selection), nextAddress)
        : createCellSelection(nextAddress)
    );
    node.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPointerSelectingRef.current) {
      return;
    }

    const nextAddress = getAddressFromPointerEvent(event);
    const anchor = pointerAnchorRef.current;

    if (!(nextAddress && anchor)) {
      return;
    }

    setSelection(createRangeSelection(anchor, nextAddress));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const node = scrollRef.current;

    if (node?.hasPointerCapture(event.pointerId)) {
      node.releasePointerCapture(event.pointerId);
    }

    isPointerSelectingRef.current = false;
    pointerAnchorRef.current = null;
  };

  const handleDoubleClick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const nextAddress = getAddressFromPointerEvent(event);

    if (!nextAddress) {
      return;
    }

    event.preventDefault();
    keyboardProxyRef.current?.focus();
    startEditing(nextAddress);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLDivElement | HTMLTextAreaElement>
  ) => {
    if (editingAddress) {
      return;
    }

    const shortcutArgs: ShortcutHandlerArgs = {
      activeCellFormat,
      applyFormattingPatch,
      clearSelectionFormatting,
      cutSelectionContents,
      event,
      insertColumn,
      insertRow,
      openRenameDialog,
      redoSelectionChange,
      setActiveHelpPanel,
      setFreezeFirstColumn,
      setFreezeTopRow,
      setShowCrosshairHighlight,
      setShowFormulaBar,
      setShowGridlines,
      undoSelectionChange,
    };

    if (handleMetaShortcuts(shortcutArgs)) {
      return;
    }

    if (handleViewShortcuts(shortcutArgs)) {
      return;
    }

    if (handleFormatAndInsertShortcuts(shortcutArgs)) {
      return;
    }

    if (handleInsertShortcuts(shortcutArgs)) {
      return;
    }

    if (
      handleNavigationShortcuts({
        activeCell,
        applySelection,
        bounds,
        clearSelectionContents,
        columnLayout,
        event,
        rowLayout,
        selection,
        startEditing,
      })
    ) {
      return;
    }
  };

  const handleCopy = (
    event: ClipboardEvent<HTMLDivElement | HTMLTextAreaElement>
  ) => {
    event.preventDefault();
    const text = getSelectionClipboardText();
    clipboardTextRef.current = text;
    event.clipboardData.setData("text/plain", text);
  };

  const handleCut = (
    event: ClipboardEvent<HTMLDivElement | HTMLTextAreaElement>
  ) => {
    handleCopy(event);
    clearSelectionContents();
  };

  const getSelectionClipboardText = () => {
    const matrix = getSelectionMatrix(
      sheet,
      selectionMembers.columns,
      selectionMembers.rows
    );

    return serializeSelectionMatrix(matrix);
  };

  const writeClipboardText = async (value: string) => {
    clipboardTextRef.current = value;

    if (!navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Ignore clipboard permission failures and keep the in-memory fallback.
    }
  };

  const readClipboardText = async () => {
    if (navigator.clipboard?.readText) {
      try {
        const value = await navigator.clipboard.readText();

        if (value) {
          clipboardTextRef.current = value;
          return value;
        }
      } catch {
        // Ignore clipboard permission failures and fall back to in-memory data.
      }
    }

    return clipboardTextRef.current;
  };

  const applyPastedMatrix = (matrix: string[][]) => {
    if (matrix.length === 0) {
      return;
    }

    runTrackedMutation(() => {
      const startColumn = selectionMembers.columns[0] ?? activeCell.col;
      const startRow = selectionMembers.rows[0] ?? activeCell.row;
      const pastedCells = matrix.flatMap((rowValues, rowOffset) =>
        rowValues.map((value, colOffset) => ({
          key: createCellKey({
            col: columnLayout.order[
              Math.min(
                columnLayout.count,
                columnLayout.logicalToVisual[startColumn] + colOffset
              ) - 1
            ],
            row: rowLayout.order[
              Math.min(
                rowLayout.count,
                rowLayout.logicalToVisual[startRow] + rowOffset
              ) - 1
            ],
          }),
          raw: value,
        }))
      );

      applyOptimisticBatchWrite(pastedCells);
      syncBatchUpsert(pastedCells);
      scheduleWriteConfirmation();
      syncDocumentTimestamp();

      const endColumnVisual = Math.min(
        columnLayout.count,
        columnLayout.logicalToVisual[startColumn] +
          Math.max(...matrix.map((row) => row.length), 1) -
          1
      );
      const endRowVisual = Math.min(
        rowLayout.count,
        rowLayout.logicalToVisual[startRow] + matrix.length - 1
      );

      applySelection(
        createRangeSelection(
          {
            col: startColumn,
            row: startRow,
          },
          {
            col: columnLayout.order[endColumnVisual - 1],
            row: rowLayout.order[endRowVisual - 1],
          }
        )
      );
    });
  };

  const copySelectionContents = async () => {
    await writeClipboardText(getSelectionClipboardText());
  };

  const cutSelectionContents = async () => {
    await copySelectionContents();
    clearSelectionContents();
  };

  const pasteSelectionContents = async () => {
    const text = await readClipboardText();
    const matrix = parseClipboardMatrix(text);

    applyPastedMatrix(matrix);
  };

  const clearSelectionFormatting = () => {
    commitTrackedSheetMutation({
      mutation: () => {
        for (const row of selectionMembers.rows) {
          for (const col of selectionMembers.columns) {
            sheet.clearCellFormat({ col, row });
          }
        }
      },
    });
  };

  const insertRow = (placement: "above" | "below") => {
    const targetRow =
      placement === "above"
        ? activeCell.row
        : Math.min(bounds.rowCount, activeCell.row + 1);

    commitTrackedSheetMutation({
      mutation: () => {
        sheet.insertRows(targetRow);
      },
      nextSelection: createCellSelection({
        col: activeCell.col,
        row: targetRow,
      }),
    });
  };

  const insertColumn = (placement: "left" | "right") => {
    const targetColumn =
      placement === "left"
        ? activeCell.col
        : Math.min(bounds.colCount, activeCell.col + 1);

    commitTrackedSheetMutation({
      mutation: () => {
        sheet.insertColumns(targetColumn);
      },
      nextSelection: createCellSelection({
        col: targetColumn,
        row: activeCell.row,
      }),
    });
  };

  const undoSelectionChange = () => {
    const previousState = historyRef.current.past.at(-1);

    if (!previousState) {
      return;
    }

    historyRef.current = {
      future: [
        ...historyRef.current.future,
        {
          selection,
          snapshot: sheet.snapshot(),
        },
      ].slice(-40),
      past: historyRef.current.past.slice(0, -1),
    };

    stopEditing();
    restoreHistoryState(previousState);
  };

  const redoSelectionChange = () => {
    const nextState = historyRef.current.future.at(-1);

    if (!nextState) {
      return;
    }

    historyRef.current = {
      future: historyRef.current.future.slice(0, -1),
      past: [
        ...historyRef.current.past,
        {
          selection,
          snapshot: sheet.snapshot(),
        },
      ].slice(-40),
    };

    stopEditing();
    restoreHistoryState(nextState);
  };

  const openRenameDialog = () => {
    setRenameDraft(document.title);
    setIsRenameDialogOpen(true);
    closeMenus();
  };

  const submitRename = async () => {
    const nextTitle = renameDraft.trim();

    if (!nextTitle) {
      return;
    }

    const renamedDocument = await renameDocument(document.id, nextTitle);
    onDocumentUpdated?.(renamedDocument);
    setIsRenameDialogOpen(false);
  };

  const handlePaste = (
    event: ClipboardEvent<HTMLDivElement | HTMLTextAreaElement>
  ) => {
    event.preventDefault();
    clipboardTextRef.current = event.clipboardData.getData("text/plain");
    applyPastedMatrix(parseClipboardMatrix(clipboardTextRef.current));
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      stopEditing();
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const delta = getNavigationDelta(
        event.key === "Enter" ? "Enter" : "Tab",
        event.shiftKey
      );
      const nextAddress = moveCellAddressInLayout(
        activeCell,
        delta,
        bounds,
        columnLayout,
        rowLayout
      );
      commitEditing({
        nextSelection: createCellSelection(nextAddress),
      });
    }
  };

  const handleFormulaBarFocus = () => {
    startEditing(activeCell, activeCellRaw, "formula-bar");
  };

  const handleFormulaBarKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      stopEditing();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      commitEditing({
        nextSelection: createCellSelection(activeCell),
      });
    }
  };

  const formulaBarValue =
    editingAddress &&
    editingAddress.row === activeCell.row &&
    editingAddress.col === activeCell.col
      ? draftValue
      : activeCellRaw;

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#ffffff]">
      <textarea
        aria-label="Spreadsheet keyboard input"
        autoFocus
        className="absolute h-px w-px overflow-hidden opacity-0"
        onChange={() => {
          // Intentionally no-op; the proxy exists only to receive keyboard events.
        }}
        onCopy={handleCopy}
        onCut={handleCut}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        readOnly
        ref={keyboardProxyRef}
        spellCheck={false}
        value=""
      />

      <div className="relative bg-white px-2 py-0.5" data-menu-root>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-0.5">
            {(
              ["file", "edit", "view", "insert", "format", "help"] as const
            ).map((menuKey) => (
              <MenuButton
                isOpen={activeMenu === menuKey}
                key={menuKey}
                label={menuKey}
                onClick={() => {
                  setActiveMenu((current) =>
                    current === menuKey ? null : menuKey
                  );
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 pr-1 text-[#80868b] text-[0.6875rem]">
            <span className="font-mono text-[#5f6368]">
              {getColumnHeaderLabel(activeCell.col)}
              {activeCell.row}
            </span>
            <span className="font-mono">
              {selectionDimensions.rowCount} x {selectionDimensions.colCount}
            </span>
            <span className="font-mono">{formatWriteState(writeState)}</span>
          </div>
        </div>

        {activeMenu ? (
          <div className="absolute top-full left-2 z-40 mt-0.5 min-w-[17rem] rounded-lg border border-[#e0e0e0] bg-white py-1.5 shadow-[0_2px_6px_2px_rgba(60,64,67,0.15),0_1px_2px_rgba(60,64,67,0.3)]">
            {activeMenu === "file" ? (
              <div className="grid gap-0.5 px-1">
                <MenuItem
                  label="Export CSV"
                  onClick={() => {
                    handleExport("csv");
                    closeMenus();
                  }}
                />
                <MenuItem
                  label="Export TSV"
                  onClick={() => {
                    handleExport("tsv");
                    closeMenus();
                  }}
                />
                <MenuItem
                  label="Export JSON"
                  onClick={() => {
                    handleExport("json");
                    closeMenus();
                  }}
                />
                <MenuItem
                  label="Rename sheet/document"
                  onClick={openRenameDialog}
                  shortcut="F2"
                />
                <MenuItem
                  label="Back to dashboard"
                  onClick={() => {
                    router.push("/dashboard");
                  }}
                />
              </div>
            ) : null}

            {activeMenu === "edit" ? (
              <div className="grid gap-0.5 px-1">
                <MenuItem
                  disabled={historyRef.current.past.length === 0}
                  label="Undo"
                  onClick={() => {
                    undoSelectionChange();
                    closeMenus();
                  }}
                  shortcut="Mod+Z"
                />
                <MenuItem
                  disabled={historyRef.current.future.length === 0}
                  label="Redo"
                  onClick={() => {
                    redoSelectionChange();
                    closeMenus();
                  }}
                  shortcut="Mod+Shift+Z"
                />
                <MenuItem
                  label="Cut"
                  onClick={() => {
                    cutSelectionContents().catch(() => undefined);
                    closeMenus();
                  }}
                  shortcut="Mod+X"
                />
                <MenuItem
                  label="Copy"
                  onClick={() => {
                    copySelectionContents().catch(() => undefined);
                    closeMenus();
                  }}
                  shortcut="Mod+C"
                />
                <MenuItem
                  label="Paste"
                  onClick={() => {
                    pasteSelectionContents().catch(() => undefined);
                    closeMenus();
                  }}
                  shortcut="Mod+V"
                />
                <MenuItem
                  label="Clear cells"
                  onClick={() => {
                    clearSelectionContents();
                    closeMenus();
                  }}
                  shortcut="Delete"
                />
                <MenuItem
                  label="Clear formatting"
                  onClick={() => {
                    clearSelectionFormatting();
                    closeMenus();
                  }}
                  shortcut="Alt+Shift+X"
                />
              </div>
            ) : null}

            {activeMenu === "view" ? (
              <div className="grid gap-0.5 px-1">
                <MenuItem
                  checked={showFormulaBar}
                  label="Show formula bar"
                  onClick={() => {
                    setShowFormulaBar((current) => !current);
                    closeMenus();
                  }}
                  shortcut="Mod+/"
                />
                <MenuItem
                  checked={showGridlines}
                  label="Show gridlines"
                  onClick={() => {
                    setShowGridlines((current) => !current);
                    closeMenus();
                  }}
                  shortcut="Alt+G"
                />
                <MenuItem
                  checked={showCrosshairHighlight}
                  label="Full row/column highlight"
                  onClick={() => {
                    setShowCrosshairHighlight((current) => !current);
                    closeMenus();
                  }}
                  shortcut="Alt+H"
                />
                <MenuItem
                  checked={freezeTopRow}
                  label="Freeze top row"
                  onClick={() => {
                    setFreezeTopRow((current) => !current);
                    closeMenus();
                  }}
                  shortcut="Alt+Shift+T"
                />
                <MenuItem
                  checked={freezeFirstColumn}
                  label="Freeze first column"
                  onClick={() => {
                    setFreezeFirstColumn((current) => !current);
                    closeMenus();
                  }}
                  shortcut="Alt+Shift+1"
                />
              </div>
            ) : null}

            {activeMenu === "insert" ? (
              <div className="grid gap-0.5 px-1">
                <MenuItem
                  label="Row above"
                  onClick={() => {
                    insertRow("above");
                    closeMenus();
                  }}
                  shortcut="Alt+Shift+Up"
                />
                <MenuItem
                  label="Row below"
                  onClick={() => {
                    insertRow("below");
                    closeMenus();
                  }}
                  shortcut="Alt+Shift+Down"
                />
                <MenuItem
                  label="Column left"
                  onClick={() => {
                    insertColumn("left");
                    closeMenus();
                  }}
                  shortcut="Alt+Shift+Left"
                />
                <MenuItem
                  label="Column right"
                  onClick={() => {
                    insertColumn("right");
                    closeMenus();
                  }}
                  shortcut="Alt+Shift+Right"
                />
              </div>
            ) : null}

            {activeMenu === "format" ? (
              <div className="grid gap-2 px-1">
                <div className="flex flex-wrap items-center gap-3 rounded border border-[#e0e0e0] bg-[#f8f9fa] px-3 py-2.5">
                  <label className="flex items-center gap-2 text-[0.8125rem]">
                    <span className="text-[#5f6368]">Font</span>
                    <select
                      className="rounded border border-[#dadce0] bg-white px-3 py-1 text-[0.8125rem] outline-none"
                      onChange={(event) => {
                        const nextFontFamily = event.target.value;

                        applyFormattingPatch({
                          fontFamily:
                            nextFontFamily === ""
                              ? undefined
                              : (nextFontFamily as CellFontFamily),
                        });
                      }}
                      value={activeFontFamily}
                    >
                      <option value="">Default</option>
                      {CELL_FONT_FAMILIES.map((fontFamily) => (
                        <option key={fontFamily} value={fontFamily}>
                          {getFontFamilyLabel(fontFamily)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-[0.8125rem]">
                    <span className="text-[#5f6368]">Size</span>
                    <select
                      className="rounded border border-[#dadce0] bg-white px-3 py-1 text-[0.8125rem] outline-none"
                      onChange={(event) => {
                        const nextFontSize = event.target.value;

                        applyFormattingPatch({
                          fontSize:
                            nextFontSize === ""
                              ? undefined
                              : (Number(nextFontSize) as CellFontSize),
                        });
                      }}
                      value={activeFontSize}
                    >
                      <option value="">Auto</option>
                      {CELL_FONT_SIZES.map((fontSize) => (
                        <option key={fontSize} value={fontSize}>
                          {fontSize}px
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-[0.8125rem]">
                    <span className="text-[#5f6368]">Text</span>
                    <input
                      className="h-7 w-9 rounded border border-[#dadce0]"
                      onChange={(event) => {
                        applyFormattingPatch({
                          textColor: event.target.value,
                        });
                      }}
                      type="color"
                      value={activeCellFormat?.textColor ?? "#172333"}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-[0.8125rem]">
                    <span className="text-[#5f6368]">Fill</span>
                    <input
                      className="h-7 w-9 rounded border border-[#dadce0]"
                      onChange={(event) => {
                        applyFormattingPatch({
                          backgroundColor: event.target.value,
                        });
                      }}
                      type="color"
                      value={activeCellFormat?.backgroundColor ?? "#ffffff"}
                    />
                  </label>
                </div>
                <div className="grid gap-0.5">
                  <MenuItem
                    checked={Boolean(activeCellFormat?.bold)}
                    label="Bold"
                    onClick={() => {
                      applyFormattingPatch({
                        bold: !activeCellFormat?.bold,
                      });
                      closeMenus();
                    }}
                    shortcut="Mod+B"
                  />
                  <MenuItem
                    checked={Boolean(activeCellFormat?.italic)}
                    label="Italic"
                    onClick={() => {
                      applyFormattingPatch({
                        italic: !activeCellFormat?.italic,
                      });
                      closeMenus();
                    }}
                    shortcut="Mod+I"
                  />
                  <MenuItem
                    checked={Boolean(activeCellFormat?.underline)}
                    label="Underline"
                    onClick={() => {
                      applyFormattingPatch({
                        underline: !activeCellFormat?.underline,
                      });
                      closeMenus();
                    }}
                    shortcut="Mod+U"
                  />
                  <MenuItem
                    checked={activeCellAlignment === "left"}
                    label="Align left"
                    onClick={() => {
                      applyFormattingPatch({
                        align:
                          activeCellFormat?.align === "left"
                            ? undefined
                            : "left",
                      });
                      closeMenus();
                    }}
                    shortcut="Alt+Shift+L"
                  />
                  <MenuItem
                    checked={activeCellAlignment === "center"}
                    label="Align center"
                    onClick={() => {
                      applyFormattingPatch({
                        align:
                          activeCellFormat?.align === "center"
                            ? undefined
                            : "center",
                      });
                      closeMenus();
                    }}
                    shortcut="Alt+Shift+E"
                  />
                  <MenuItem
                    checked={activeCellAlignment === "right"}
                    label="Align right"
                    onClick={() => {
                      applyFormattingPatch({
                        align:
                          activeCellFormat?.align === "right"
                            ? undefined
                            : "right",
                      });
                      closeMenus();
                    }}
                    shortcut="Alt+Shift+R"
                  />
                </div>
              </div>
            ) : null}

            {activeMenu === "help" ? (
              <div className="grid gap-0.5 px-1">
                <MenuItem
                  label="Keyboard shortcuts"
                  onClick={() => {
                    setActiveHelpPanel("shortcuts");
                    closeMenus();
                  }}
                  shortcut="Shift+?"
                />
                <MenuItem
                  label="Formula examples"
                  onClick={() => {
                    setActiveHelpPanel("formulas");
                    closeMenus();
                  }}
                />
                <MenuItem
                  label="About this sheet"
                  onClick={() => {
                    setActiveHelpPanel("about");
                    closeMenus();
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="border-[#e0e0e0] border-b bg-[linear-gradient(180deg,#f4f7fb_0%,#edf2fa_100%)]">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <div className="flex items-center gap-1 rounded-lg bg-white/92 p-1 shadow-[0_1px_2px_rgba(32,33,36,0.08)] ring-1 ring-[#d6dbe3]">
            <label
              className="flex items-center gap-2 rounded-md px-2 py-1 text-[#202124] text-[0.75rem] transition-colors hover:bg-[#f6f8fb]"
              title="Font family"
            >
              <span className="text-[#5f6368]">
                <FontFamilyIcon />
              </span>
              <span className="sr-only">Font family</span>
              <select
                aria-label="Cell font family"
                className="min-w-[5.75rem] bg-transparent text-[0.75rem] outline-none"
                onChange={(event) => {
                  const nextFontFamily = event.target.value;

                  applyFormattingPatch({
                    fontFamily:
                      nextFontFamily === ""
                        ? undefined
                        : (nextFontFamily as CellFontFamily),
                  });
                }}
                value={activeFontFamily}
              >
                <option value="">Default</option>
                {CELL_FONT_FAMILIES.map((fontFamily) => (
                  <option key={fontFamily} value={fontFamily}>
                    {getFontFamilyLabel(fontFamily)}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="flex items-center gap-2 rounded-md px-2 py-1 text-[#202124] text-[0.75rem] transition-colors hover:bg-[#f6f8fb]"
              title="Font size"
            >
              <span className="text-[#5f6368]">
                <FontSizeIcon />
              </span>
              <span className="sr-only">Font size</span>
              <select
                aria-label="Cell font size"
                className="w-11 bg-transparent text-[0.75rem] outline-none"
                onChange={(event) => {
                  const nextFontSize = event.target.value;

                  applyFormattingPatch({
                    fontSize:
                      nextFontSize === ""
                        ? undefined
                        : (Number(nextFontSize) as CellFontSize),
                  });
                }}
                value={activeFontSize}
              >
                <option value="">Auto</option>
                {CELL_FONT_SIZES.map((fontSize) => (
                  <option key={fontSize} value={fontSize}>
                    {fontSize}px
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-white/92 p-1 shadow-[0_1px_2px_rgba(32,33,36,0.08)] ring-1 ring-[#d6dbe3]">
            <button
              aria-label="Bold"
              className={getToolbarButtonClassName(
                Boolean(activeCellFormat?.bold)
              )}
              onClick={() => {
                applyFormattingPatch({
                  bold: !activeCellFormat?.bold,
                });
              }}
              title="Bold"
              type="button"
            >
              <span className="font-black text-[0.82rem]">B</span>
            </button>
            <button
              aria-label="Italic"
              className={getToolbarButtonClassName(
                Boolean(activeCellFormat?.italic)
              )}
              onClick={() => {
                applyFormattingPatch({
                  italic: !activeCellFormat?.italic,
                });
              }}
              title="Italic"
              type="button"
            >
              <span className="text-[0.82rem] italic">I</span>
            </button>
            <button
              aria-label="Underline"
              className={getToolbarButtonClassName(
                Boolean(activeCellFormat?.underline)
              )}
              onClick={() => {
                applyFormattingPatch({
                  underline: !activeCellFormat?.underline,
                });
              }}
              title="Underline"
              type="button"
            >
              <span className="text-[0.82rem] underline decoration-[1.5px] underline-offset-[2px]">
                U
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-white/92 p-1 shadow-[0_1px_2px_rgba(32,33,36,0.08)] ring-1 ring-[#d6dbe3]">
            <label
              className="flex items-center gap-2 rounded-md px-2 py-1 text-[#202124] text-[0.75rem] transition-colors hover:bg-[#f6f8fb]"
              title="Text color"
            >
              <span className="text-[#5f6368]">
                <TextColorIcon />
              </span>
              <span
                aria-hidden="true"
                className="h-3 w-3 rounded-full border border-[#c5c9ce]"
                style={{
                  backgroundColor: activeCellFormat?.textColor ?? "#172333",
                }}
              />
              <span className="sr-only">Text color</span>
              <input
                aria-label="Cell text color"
                className="h-6 w-7 cursor-pointer rounded border-none bg-transparent p-0"
                onChange={(event) => {
                  applyFormattingPatch({
                    textColor: event.target.value,
                  });
                }}
                title="Text color"
                type="color"
                value={activeCellFormat?.textColor ?? "#172333"}
              />
            </label>
            <label
              className="flex items-center gap-2 rounded-md px-2 py-1 text-[#202124] text-[0.75rem] transition-colors hover:bg-[#f6f8fb]"
              title="Fill color"
            >
              <span className="text-[#5f6368]">
                <FillColorIcon />
              </span>
              <span
                aria-hidden="true"
                className="h-3 w-3 rounded-full border border-[#c5c9ce]"
                style={{
                  backgroundColor:
                    activeCellFormat?.backgroundColor ?? "#ffffff",
                }}
              />
              <span className="sr-only">Fill color</span>
              <input
                aria-label="Cell fill color"
                className="h-6 w-7 cursor-pointer rounded border-none bg-transparent p-0"
                onChange={(event) => {
                  applyFormattingPatch({
                    backgroundColor: event.target.value,
                  });
                }}
                title="Fill color"
                type="color"
                value={activeCellFormat?.backgroundColor ?? "#ffffff"}
              />
            </label>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-white/92 p-1 shadow-[0_1px_2px_rgba(32,33,36,0.08)] ring-1 ring-[#d6dbe3]">
            {(
              [
                {
                  alignment: "left" as const,
                  icon: <AlignLeftIcon />,
                  label: "Align left",
                },
                {
                  alignment: "center" as const,
                  icon: <AlignCenterIcon />,
                  label: "Align center",
                },
                {
                  alignment: "right" as const,
                  icon: <AlignRightIcon />,
                  label: "Align right",
                },
              ] as const
            ).map(({ alignment, icon, label }) => (
              <button
                aria-label={label}
                className={getToolbarButtonClassName(
                  activeCellAlignment === alignment
                )}
                key={alignment}
                onClick={() => {
                  applyFormattingPatch({
                    align:
                      activeCellFormat?.align === alignment
                        ? undefined
                        : alignment,
                  });
                }}
                title={label}
                type="button"
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
        {showFormulaBar ? (
          <div className="grid grid-cols-[5rem_2rem_minmax(0,1fr)_auto] items-center gap-0 border-[#e0e0e0] border-t">
            <div className="flex h-full items-center border-[#e0e0e0] border-r px-3 font-mono text-[#202124] text-[0.75rem]">
              {getColumnHeaderLabel(activeCell.col)}
              {activeCell.row}
            </div>
            <div className="flex h-full items-center justify-center border-[#e0e0e0] border-r text-[#80868b] text-[0.75rem] italic">
              fx
            </div>
            <input
              className="h-8 w-full bg-transparent px-2.5 text-[#202124] text-[0.8125rem] outline-none placeholder:text-[#9aa0a6]"
              onBlur={() => {
                if (editingSurface === "formula-bar") {
                  commitEditing({
                    nextSelection: createCellSelection(activeCell),
                  });
                }
              }}
              onChange={(event) => {
                if (
                  editingAddress == null ||
                  editingSurface !== "formula-bar"
                ) {
                  setEditingAddress(activeCell);
                  setEditingSurface("formula-bar");
                }

                setDraftValue(event.target.value);
                setEditorMode(
                  event.target.value.startsWith("=") ? "formula" : "edit"
                );
              }}
              onFocus={handleFormulaBarFocus}
              onKeyDown={handleFormulaBarKeyDown}
              placeholder="Type a value or formula"
              ref={formulaBarRef}
              value={formulaBarValue}
            />
            <div className="flex items-center justify-end gap-2.5 border-[#e0e0e0] border-l px-3 text-[#80868b] text-[0.6875rem]">
              <span>{isReady ? "Ready" : "Loading"}</span>
              <span>{status}</span>
              {lastRemoteLatencyMs != null ? (
                <span>{lastRemoteLatencyMs}ms</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[3rem_minmax(0,1fr)] grid-rows-[1.75rem_minmax(0,1fr)] bg-white">
        <div
          className={`bg-[#f8f9fa] ${
            showGridlines ? "border-[#e0e0e0] border-r border-b" : ""
          }`}
        />

        <div
          className={`relative overflow-hidden bg-[#f8f9fa] ${
            showGridlines ? "border-[#e0e0e0] border-b" : ""
          }`}
        >
          {visibleColumns.map((column) => {
            const layout = getAxisLayoutByLogicalIndex(columnLayout, column);
            const left = layout.start - viewport.scrollX;
            const isSelectedColumn = selectedColumnSet.has(column);
            const isActiveColumn = column === activeCell.col;

            return (
              <div
                className={`absolute top-0 h-full ${
                  showGridlines ? "border-[#e0e0e0] border-r" : ""
                }`}
                key={`column-${column}`}
                style={{
                  backgroundColor: getHeaderBackgroundColor(
                    isActiveColumn,
                    isSelectedColumn
                  ),
                  color: isSelectedColumn ? "#202124" : "#5f6368",
                  left,
                  width: layout.size,
                }}
              >
                <div className="flex h-full select-none items-center justify-center px-1 text-[0.6875rem] leading-none">
                  <span>{getColumnHeaderLabel(column)}</span>
                </div>
                <div
                  className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setHeaderDragState({
                      axis: "col",
                      logicalIndex: column,
                      type: "resize",
                    });
                  }}
                />
              </div>
            );
          })}
        </div>

        <div
          className={`relative overflow-hidden bg-[#f8f9fa] ${
            showGridlines ? "border-[#e0e0e0] border-r" : ""
          }`}
        >
          {visibleRows.map((row) => {
            const layout = getAxisLayoutByLogicalIndex(rowLayout, row);
            const top = layout.start - viewport.scrollY;
            const isSelectedRow = selectedRowSet.has(row);
            const isActiveRow = row === activeCell.row;

            return (
              <div
                className={`absolute left-0 ${
                  showGridlines ? "border-[#e0e0e0] border-b" : ""
                }`}
                key={`row-${row}`}
                style={{
                  backgroundColor: getHeaderBackgroundColor(
                    isActiveRow,
                    isSelectedRow
                  ),
                  color: isSelectedRow ? "#202124" : "#5f6368",
                  height: layout.size,
                  top,
                  width: "100%",
                }}
              >
                <div className="flex h-full select-none items-center justify-center px-1 text-[0.6875rem] leading-none">
                  <span>{row}</span>
                </div>
                <div
                  className="absolute right-0 bottom-0 h-2 w-full cursor-row-resize"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setHeaderDragState({
                      axis: "row",
                      logicalIndex: row,
                      type: "resize",
                    });
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: custom spreadsheet surfaces use pointer-driven selection on a scroll container */}
        <div
          aria-label="Spreadsheet grid"
          className="relative overflow-auto bg-white outline-none"
          onDoubleClick={handleDoubleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onScroll={handleScroll}
          ref={scrollRef}
          role="application"
        >
          <div
            className="relative"
            style={{
              height: gridHeight,
              width: gridWidth,
            }}
          >
            {showCrosshairHighlight ? (
              <>
                <div
                  className="pointer-events-none absolute left-0 bg-[rgba(37,99,235,0.04)]"
                  style={{
                    height: activeCellLayout.height,
                    top: activeCellLayout.top,
                    width: "100%",
                  }}
                />
                <div
                  className="pointer-events-none absolute top-0 bg-[rgba(37,99,235,0.04)]"
                  style={{
                    height: "100%",
                    left: activeCellLayout.left,
                    width: activeCellLayout.width,
                  }}
                />
              </>
            ) : null}

            {visibleRows.flatMap((row) =>
              visibleColumns.map((column) => (
                <VirtualCell
                  address={{ col: column, row }}
                  columnLayout={columnLayout}
                  computedValue={computedValues.get(
                    createCellKey({ col: column, row })
                  )}
                  format={sheet.getCellFormat({ col: column, row })}
                  formulaError={formulaErrors.get(
                    createCellKey({ col: column, row })
                  )}
                  isActive={activeCell.col === column && activeCell.row === row}
                  isGridlinesVisible={showGridlines}
                  isSelected={
                    selectedColumnSet.has(column) && selectedRowSet.has(row)
                  }
                  key={`${row}:${column}`}
                  record={sheet.getCell({ col: column, row })}
                  rowLayout={rowLayout}
                />
              ))
            )}

            {freezeTopRow
              ? visibleColumns.map((column) => (
                  <VirtualCell
                    address={{ col: column, row: 1 }}
                    columnLayout={columnLayout}
                    computedValue={computedValues.get(
                      createCellKey({ col: column, row: 1 })
                    )}
                    displayTop={viewport.scrollY}
                    format={sheet.getCellFormat({ col: column, row: 1 })}
                    formulaError={formulaErrors.get(
                      createCellKey({ col: column, row: 1 })
                    )}
                    isActive={activeCell.col === column && activeCell.row === 1}
                    isFrozen
                    isGridlinesVisible={showGridlines}
                    isSelected={
                      selectedColumnSet.has(column) && selectedRowSet.has(1)
                    }
                    key={`frozen-top-${column}`}
                    record={sheet.getCell({ col: column, row: 1 })}
                    rowLayout={rowLayout}
                  />
                ))
              : null}

            {freezeFirstColumn
              ? visibleRows.map((row) => (
                  <VirtualCell
                    address={{ col: 1, row }}
                    columnLayout={columnLayout}
                    computedValue={computedValues.get(
                      createCellKey({ col: 1, row })
                    )}
                    displayLeft={viewport.scrollX}
                    format={sheet.getCellFormat({ col: 1, row })}
                    formulaError={formulaErrors.get(
                      createCellKey({ col: 1, row })
                    )}
                    isActive={activeCell.col === 1 && activeCell.row === row}
                    isFrozen
                    isGridlinesVisible={showGridlines}
                    isSelected={
                      selectedColumnSet.has(1) && selectedRowSet.has(row)
                    }
                    key={`frozen-left-${row}`}
                    record={sheet.getCell({ col: 1, row })}
                    rowLayout={rowLayout}
                  />
                ))
              : null}

            {freezeTopRow && freezeFirstColumn ? (
              <VirtualCell
                address={{ col: 1, row: 1 }}
                columnLayout={columnLayout}
                computedValue={computedValues.get(
                  createCellKey({ col: 1, row: 1 })
                )}
                displayLeft={viewport.scrollX}
                displayTop={viewport.scrollY}
                format={sheet.getCellFormat({ col: 1, row: 1 })}
                formulaError={formulaErrors.get(
                  createCellKey({ col: 1, row: 1 })
                )}
                isActive={activeCell.col === 1 && activeCell.row === 1}
                isFrozen
                isGridlinesVisible={showGridlines}
                isSelected={selectedColumnSet.has(1) && selectedRowSet.has(1)}
                key="frozen-corner"
                record={sheet.getCell({ col: 1, row: 1 })}
                rowLayout={rowLayout}
              />
            ) : null}

            <div
              className="pointer-events-none absolute bg-[rgba(37,99,235,0.08)]"
              style={{
                height: selectionRect.height,
                left: selectionRect.left,
                top: selectionRect.top,
                width: selectionRect.width,
              }}
            />

            <div
              className="pointer-events-none absolute border-2 border-[#2563eb] shadow-[0_0_0_1px_rgba(255,255,255,0.92)]"
              style={{
                height: selectionRect.height,
                left: selectionRect.left,
                top: selectionRect.top,
                width: selectionRect.width,
              }}
            />

            <div
              className="pointer-events-none absolute border-2 border-[#2563eb]"
              style={{
                height: activeCellLayout.height,
                left: activeCellLayout.left,
                top: activeCellLayout.top,
                width: activeCellLayout.width,
              }}
            />

            {peers.map((peer) => {
              const peerActiveCell = peer.activeCell
                ? parseCellKey(peer.activeCell)
                : null;
              const peerSelection =
                peer.selection == null
                  ? null
                  : createRangeSelection(
                      parseCellKey(peer.selection.start),
                      parseCellKey(peer.selection.end)
                    );
              const peerSelectionRect =
                peerSelection == null
                  ? null
                  : getSelectionRect(peerSelection, columnLayout, rowLayout);

              return (
                <div key={`peer-overlay-${peer.userId}`}>
                  {peerSelectionRect ? (
                    <div
                      className="pointer-events-none absolute border-2"
                      style={{
                        borderColor: peer.color,
                        height: peerSelectionRect.height,
                        left: peerSelectionRect.left,
                        top: peerSelectionRect.top,
                        width: peerSelectionRect.width,
                      }}
                    />
                  ) : null}
                  {peerActiveCell
                    ? (() => {
                        const peerCellLayout = getCellLayout(
                          peerActiveCell,
                          columnLayout,
                          rowLayout
                        );
                        return (
                          <div
                            className="pointer-events-none absolute border-2"
                            style={{
                              borderColor: peer.color,
                              height: peerCellLayout.height,
                              left: peerCellLayout.left,
                              top: peerCellLayout.top,
                              width: peerCellLayout.width,
                            }}
                          />
                        );
                      })()
                    : null}
                </div>
              );
            })}

            {headerDragState?.type === "reorder" &&
            headerDragState.axis === "col" ? (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-20 w-[3px] bg-[#2563eb]"
                style={{
                  left:
                    getAxisLayoutByLogicalIndex(
                      columnLayout,
                      headerDragState.targetLogicalIndex
                    ).start - 1,
                }}
              />
            ) : null}

            {headerDragState?.type === "reorder" &&
            headerDragState.axis === "row" ? (
              <div
                className="pointer-events-none absolute right-0 left-0 z-20 h-[3px] bg-[#2563eb]"
                style={{
                  top:
                    getAxisLayoutByLogicalIndex(
                      rowLayout,
                      headerDragState.targetLogicalIndex
                    ).start - 1,
                }}
              />
            ) : null}

            {editingAddress && editingSurface === "cell" ? (
              <div
                className="absolute z-20 border-2 border-[#2563eb] bg-white shadow-[0_8px_24px_rgba(32,33,36,0.16)]"
                style={{
                  height: activeCellLayout.height,
                  left: activeCellLayout.left,
                  top: activeCellLayout.top,
                  width: activeCellLayout.width,
                }}
              >
                <input
                  className="h-full w-full bg-transparent px-2 py-1 text-[0.76rem] text-[var(--foreground)] outline-none"
                  onBlur={() => {
                    commitEditing();
                  }}
                  onChange={(event) => {
                    setDraftValue(event.target.value);
                    setEditorMode(
                      event.target.value.startsWith("=") ? "formula" : "edit"
                    );
                  }}
                  onKeyDown={handleInputKeyDown}
                  ref={inputRef}
                  value={draftValue}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {isRenameDialogOpen ? (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(32,33,36,0.18)] px-4"
          data-dialog-root
        >
          <div className="w-full max-w-md border border-[#dadce0] bg-white p-5 shadow-[0_20px_48px_rgba(32,33,36,0.18)]">
            <p className="font-mono text-[#5f6368] text-[0.68rem] uppercase tracking-[0.18em]">
              Rename sheet
            </p>
            <input
              className="mt-4 w-full border border-[#dadce0] bg-white px-4 py-3 text-[0.84rem] outline-none"
              onChange={(event) => {
                setRenameDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitRename().catch(() => undefined);
                }
              }}
              value={renameDraft}
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="border border-[#dadce0] px-4 py-2 text-[0.76rem] uppercase tracking-[0.14em]"
                onClick={() => {
                  setIsRenameDialogOpen(false);
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="border border-[#16a34a] bg-[#16a34a] px-4 py-2 text-[0.76rem] text-white uppercase tracking-[0.14em]"
                onClick={() => {
                  submitRename().catch(() => undefined);
                }}
                type="button"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeHelpPanel ? (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(32,33,36,0.18)] px-4"
          data-dialog-root
        >
          <div className="w-full max-w-2xl border border-[#dadce0] bg-white p-5 shadow-[0_20px_48px_rgba(32,33,36,0.18)]">
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-[#5f6368] text-[0.68rem] uppercase tracking-[0.18em]">
                {getHelpPanelTitle(activeHelpPanel)}
              </p>
              <button
                className="border border-[#dadce0] px-4 py-2 text-[0.76rem] uppercase tracking-[0.14em]"
                onClick={() => {
                  setActiveHelpPanel(null);
                }}
                type="button"
              >
                Close
              </button>
            </div>

            {activeHelpPanel === "shortcuts" ? (
              <div className="mt-4 grid gap-2 text-[0.82rem]">
                {[
                  ["Rename sheet", "F2"],
                  ["Undo", "Mod+Z"],
                  ["Redo", "Mod+Shift+Z"],
                  ["Cut", "Mod+X"],
                  ["Copy", "Mod+C"],
                  ["Paste", "Mod+V"],
                  ["Bold", "Mod+B"],
                  ["Italic", "Mod+I"],
                  ["Underline", "Mod+U"],
                  ["Toggle formula bar", "Mod+/"],
                  ["Toggle gridlines", "Alt+G"],
                  ["Toggle row/column highlight", "Alt+H"],
                ].map(([label, shortcut]) => (
                  <div
                    className="flex items-center justify-between border border-[#dadce0] bg-[#f8f9fa] px-4 py-3"
                    key={label}
                  >
                    <span>{label}</span>
                    {createShortcutLabel(shortcut)}
                  </div>
                ))}
              </div>
            ) : null}

            {activeHelpPanel === "formulas" ? (
              <div className="mt-4 grid gap-3 text-[0.82rem]">
                {["=A1+B1", "=SUM(A1:B5)", "=SUM(A1,C1,D1)", "=A5/B5"].map(
                  (example) => (
                    <div
                      className="border border-[#dadce0] bg-[#f8f9fa] px-4 py-3 font-mono"
                      key={example}
                    >
                      {example}
                    </div>
                  )
                )}
              </div>
            ) : null}

            {activeHelpPanel === "about" ? (
              <div className="mt-4 grid gap-2 text-[0.82rem]">
                <div className="border border-[#dadce0] bg-[#f8f9fa] px-4 py-3">
                  <p>{document.title}</p>
                  <p className="mt-2 text-[#5f6368]">
                    {bounds.rowCount.toLocaleString()} rows ·{" "}
                    {bounds.colCount.toLocaleString()} columns ·{" "}
                    {sheet.cellCount.toLocaleString()} populated cells
                  </p>
                </div>
                <div className="border border-[#dadce0] bg-[#f8f9fa] px-4 py-3 text-[#5f6368]">
                  Sparse data, virtual rendering, and lightweight formatting
                  metadata keep this editor fast even as the sheet grows.
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

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
  captureLayoutState,
  createSeededSheet,
  formatWriteState,
  getCellDisplayValue,
  getCellKind,
  getSelectionMatrix,
} from "@/features/spreadsheet/functions/virtualized-sheet-display";
import {
  downloadExport,
  sanitizeFileName,
} from "@/features/spreadsheet/functions/virtualized-sheet-file";
import {
  findCellMatches,
  type SearchMatch,
  sortRowsByColumn,
} from "@/features/spreadsheet/functions/virtualized-sheet-search";
import {
  handleFormatAndInsertShortcuts,
  handleInsertShortcuts,
  handleMetaShortcuts,
  handleNavigationShortcuts,
  handleViewShortcuts,
  type ShortcutHandlerArgs,
} from "@/features/spreadsheet/functions/virtualized-sheet-shortcuts";
import { getHeaderBackgroundColor } from "@/features/spreadsheet/functions/virtualized-sheet-styles";
import {
  applyRemoteChanges,
  commitHeaderDrag,
  getSnapshotChanges,
  hasSnapshotChanges,
} from "@/features/spreadsheet/functions/virtualized-sheet-sync";
import {
  DEFAULT_VIEWPORT_HEIGHT,
  DEFAULT_VIEWPORT_WIDTH,
  useVirtualViewport,
} from "@/features/spreadsheet/hooks/use-virtual-viewport";
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
import type {
  EditorSurface,
  HeaderDragState,
  HelpPanel,
  HistoryState,
  KeyedChange,
  MenuKey,
  SnapshotChanges,
} from "@/features/spreadsheet/types/virtualized-sheet";
import { HelpPanelDialog } from "@/features/spreadsheet/ui/help-panel-dialog";
import { RenameSheetDialog } from "@/features/spreadsheet/ui/rename-sheet-dialog";
import { SearchPanel } from "@/features/spreadsheet/ui/search-panel";
import { SheetMenuBar } from "@/features/spreadsheet/ui/sheet-menu-bar";
import { SheetToolbar } from "@/features/spreadsheet/ui/sheet-toolbar";
import { VirtualCell } from "@/features/spreadsheet/ui/virtual-cell";
import {
  DEFAULT_SHEET_METRICS,
  getCellAddressFromPoint,
  getCellLayout,
  getColumnHeaderLabel,
  getGridDimensions,
} from "@/features/spreadsheet/viewport";
import { renameDocument, touchDocument } from "@/lib/metadata/metadata-store";
import type { CollaborationPresenceSnapshot } from "@/types/collaboration";
import type { DocumentMeta, SessionIdentity } from "@/types/metadata";
import type {
  CellAddress,
  CellFormat,
  CellFormatRecord,
  CellRecord,
  Selection,
} from "@/types/spreadsheet";
import type { EditorMode, WriteState } from "@/types/ui";
import type { SparseSheetSnapshot } from "./sparse-sheet";

const DEFAULT_SELECTION: CellAddress = {
  col: 1,
  row: 1,
};
const LIVE_EDIT_SYNC_DELAY_MS = 90;
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
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const keyboardProxyRef = useRef<HTMLTextAreaElement | null>(null);
  const cellEditorSelectionBehaviorRef = useRef<"caret-at-end" | "select-all">(
    "select-all"
  );
  const editSessionInitialValueRef = useRef<string | null>(null);
  const editSessionHistoryStateRef = useRef<HistoryState | null>(null);
  const pointerAnchorRef = useRef<CellAddress | null>(null);
  const clipboardTextRef = useRef("");
  const isPointerSelectingRef = useRef(false);
  const commitTimerRef = useRef<number | null>(null);
  const liveEditSyncTimerRef = useRef<number | null>(null);
  const pendingLiveEditSyncRef = useRef<{
    address: CellAddress;
    raw: string;
  } | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const writeStateRef = useRef<WriteState>("idle");
  const historyRef = useRef<{
    future: HistoryState[];
    past: HistoryState[];
  }>({
    future: [],
    past: [],
  });
  const [cellRevision, setCellRevision] = useState(0);
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
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [isSearchCaseSensitive, setIsSearchCaseSensitive] = useState(false);
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
  const cellsSnapshot = useMemo(() => {
    if (cellRevision < 0) {
      return new Map();
    }

    return sheet.getCells();
  }, [cellRevision, sheet]);
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
  const isFullRowSelection = selectedColumnSet.size === bounds.colCount;
  const isFullColumnSelection = selectedRowSet.size === bounds.rowCount;
  const populatedRows = useMemo(() => {
    const usedRows = new Set<number>();

    for (const key of cellsSnapshot.keys()) {
      usedRows.add(parseCellKey(key).row);
    }

    return sheet.getRowOrder().filter((row) => usedRows.has(row));
  }, [cellsSnapshot, sheet]);
  const searchMatches = useMemo(
    () =>
      isSearchPanelOpen
        ? findCellMatches({
            caseSensitive: isSearchCaseSensitive,
            cells: cellsSnapshot,
            query: searchQuery,
          })
        : ([] as SearchMatch[]),
    [cellsSnapshot, isSearchCaseSensitive, isSearchPanelOpen, searchQuery]
  );
  const activeSearchMatchIndex = useMemo(
    () => searchMatches.findIndex((match) => match.key === activeCellKey),
    [activeCellKey, searchMatches]
  );
  const seededSheetSnapshot = useMemo(() => createSeededSheet().snapshot(), []);
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
  const openSearchPanel = () => {
    setIsSearchPanelOpen(true);
    closeMenus();
  };
  const closeSearchPanel = () => {
    setIsSearchPanelOpen(false);
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

  const applyOptimisticCellWrite = (
    address: CellAddress,
    raw: string,
    options?: {
      syncFormula?: boolean;
    }
  ) => {
    const key = createCellKey(address);
    const shouldSyncFormula = options?.syncFormula ?? true;

    if (raw.trim() === "") {
      const changed = sheet.clearCell(address);

      if (changed) {
        if (shouldSyncFormula) {
          deleteCell(key);
        }
        setCellRevisionWithTransition();
      }

      return;
    }

    sheet.setCellByKey(key, {
      kind: getCellKind(raw),
      raw,
    });

    if (shouldSyncFormula) {
      upsertFormulaCell({
        key,
        raw,
      });
    }

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

  const applySelection = (
    nextSelection: Selection,
    visibleAddress?: CellAddress
  ) => {
    setSelection(nextSelection);
    ensureCellVisible(
      visibleAddress ??
        (nextSelection.type === "cell"
          ? nextSelection.anchor
          : nextSelection.end)
    );
  };
  const selectColumn = (column: number) => {
    applySelection(
      createRangeSelection(
        { col: column, row: 1 },
        { col: column, row: bounds.rowCount }
      ),
      { col: column, row: activeCell.row }
    );
  };
  const selectRow = (row: number) => {
    applySelection(
      createRangeSelection({ col: 1, row }, { col: bounds.colCount, row }),
      { col: activeCell.col, row }
    );
  };

  const resetEditSessionTracking = () => {
    editSessionInitialValueRef.current = null;
    editSessionHistoryStateRef.current = null;
  };

  const flushPendingLiveEditSync = () => {
    const pendingSync = pendingLiveEditSyncRef.current;

    if (!pendingSync) {
      return;
    }

    pendingLiveEditSyncRef.current = null;

    if (
      typeof window !== "undefined" &&
      liveEditSyncTimerRef.current !== null
    ) {
      window.clearTimeout(liveEditSyncTimerRef.current);
      liveEditSyncTimerRef.current = null;
    }

    const key = createCellKey(pendingSync.address);

    syncUpsertCell({
      key,
      raw: pendingSync.raw,
    });

    if (pendingSync.raw.trim() === "") {
      deleteCell(key);
    } else {
      upsertFormulaCell({
        key,
        raw: pendingSync.raw,
      });
    }

    scheduleWriteConfirmation();
  };

  const syncLiveEditValue = (address: CellAddress, raw: string) => {
    if (getCellDisplayValue(sheet.getCell(address)) === raw) {
      return;
    }

    applyOptimisticCellWrite(address, raw, {
      syncFormula: false,
    });
    pendingLiveEditSyncRef.current = {
      address,
      raw,
    };

    if (typeof window === "undefined") {
      flushPendingLiveEditSync();
      return;
    }

    if (liveEditSyncTimerRef.current !== null) {
      window.clearTimeout(liveEditSyncTimerRef.current);
    }

    liveEditSyncTimerRef.current = window.setTimeout(() => {
      liveEditSyncTimerRef.current = null;
      flushPendingLiveEditSync();
    }, LIVE_EDIT_SYNC_DELAY_MS);
  };

  const finalizeEditHistory = () => {
    const beforeState = editSessionHistoryStateRef.current;

    if (!beforeState) {
      resetEditSessionTracking();
      return false;
    }

    const afterSnapshot = sheet.snapshot();
    const changes = getSnapshotChanges(beforeState.snapshot, afterSnapshot);
    const didChange = hasSnapshotChanges(
      changes,
      beforeState.snapshot,
      afterSnapshot
    );

    if (didChange) {
      pushHistoryState(beforeState);
    }

    resetEditSessionTracking();
    return didChange;
  };

  const revertLiveEdit = (address: CellAddress) => {
    const initialValue = editSessionInitialValueRef.current;

    if (initialValue == null) {
      resetEditSessionTracking();
      return;
    }

    syncLiveEditValue(address, initialValue);
    resetEditSessionTracking();
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
    surface: EditorSurface = "cell",
    options?: {
      selectAll?: boolean;
    }
  ) => {
    const originalValue = getCellDisplayValue(sheet.getCell(address));
    const isSameEditingCell =
      editingAddress?.row === address.row && editingAddress.col === address.col;
    const nextValue = initialValue ?? originalValue;

    if (!isSameEditingCell) {
      editSessionInitialValueRef.current = originalValue;
      editSessionHistoryStateRef.current = {
        selection,
        snapshot: sheet.snapshot(),
      };
    }

    setEditingAddress(address);
    setEditingSurface(surface);
    setDraftValue(nextValue);
    setEditorMode(nextValue.startsWith("=") ? "formula" : "edit");

    if (surface === "cell") {
      cellEditorSelectionBehaviorRef.current =
        options?.selectAll === false ? "caret-at-end" : "select-all";
      applySelection(createCellSelection(address));
    }
  };

  const startTypingEdit = (address: CellAddress, initialValue: string) => {
    startEditing(address, initialValue, "cell", {
      selectAll: false,
    });
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

    syncLiveEditValue(editingAddress, draftValue);
    flushPendingLiveEditSync();
    const didChange = finalizeEditHistory();
    const nextSelection =
      options?.nextSelection ?? createCellSelection(editingAddress);
    stopEditing();

    if (didChange) {
      syncDocumentTimestamp();
    }

    applySelection(nextSelection);
  };

  const cancelEditing = () => {
    if (!editingAddress) {
      return;
    }

    revertLiveEdit(editingAddress);
    flushPendingLiveEditSync();
    stopEditing();
    applySelection(createCellSelection(editingAddress));
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
    const input = inputRef.current;

    if (!input) {
      return;
    }

    if (cellEditorSelectionBehaviorRef.current === "select-all") {
      input.select();
      return;
    }

    const caretPosition = input.value.length;
    input.setSelectionRange(caretPosition, caretPosition);
  }, [editingAddress]);

  useEffect(() => {
    if (!(editingAddress && editingSurface === "formula-bar")) {
      return;
    }

    formulaBarRef.current?.focus();
    formulaBarRef.current?.select();
  }, [editingAddress, editingSurface]);

  useEffect(() => {
    if (!isSearchPanelOpen) {
      return;
    }

    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [isSearchPanelOpen]);

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
        setIsSearchPanelOpen(false);
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
  const handleColumnHeaderPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    column: number
  ) => {
    event.preventDefault();
    event.stopPropagation();
    keyboardProxyRef.current?.focus();

    if (isFullColumnSelection && selectedColumnSet.has(column)) {
      setHeaderDragState({
        axis: "col",
        sourceLogicalIndex: column,
        targetLogicalIndex: column,
        type: "reorder",
      });
      return;
    }

    selectColumn(column);
  };
  const handleRowHeaderPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    row: number
  ) => {
    event.preventDefault();
    event.stopPropagation();
    keyboardProxyRef.current?.focus();

    if (isFullRowSelection && selectedRowSet.has(row)) {
      setHeaderDragState({
        axis: "row",
        sourceLogicalIndex: row,
        targetLogicalIndex: row,
        type: "reorder",
      });
      return;
    }

    selectRow(row);
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
      openSearchPanel,
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
        startTypingEdit,
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

  const sortSelectionRows = (direction: "asc" | "desc") => {
    const targetRows =
      selectionMembers.rows.length > 1 ? selectionMembers.rows : populatedRows;

    if (targetRows.length < 2) {
      return;
    }

    const nextRowOrder = sortRowsByColumn({
      direction,
      preserveFirstRow: targetRows.includes(1),
      rowOrder: sheet.getRowOrder(),
      rows: targetRows,
      sheet,
      sortColumn: activeCell.col,
    });

    commitTrackedSheetMutation({
      mutation: () => {
        sheet.setRowOrder(nextRowOrder);
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

  const escapeSearchPattern = (value: string) =>
    value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

  const replaceSearchValue = (value: string, replaceAll: boolean) => {
    if (searchQuery.trim() === "") {
      return value;
    }

    const pattern = new RegExp(
      escapeSearchPattern(searchQuery),
      `${replaceAll ? "g" : ""}${isSearchCaseSensitive ? "" : "i"}`
    );

    return value.replace(pattern, replaceValue);
  };

  const jumpToSearchMatch = (direction: "next" | "previous") => {
    if (searchMatches.length === 0) {
      return;
    }

    const delta = direction === "next" ? 1 : -1;
    let nextIndex =
      (activeSearchMatchIndex + delta + searchMatches.length) %
      searchMatches.length;

    if (activeSearchMatchIndex === -1) {
      nextIndex = direction === "next" ? 0 : searchMatches.length - 1;
    }
    const nextMatch = searchMatches[nextIndex];

    if (!nextMatch) {
      return;
    }

    applySelection(createCellSelection(parseCellKey(nextMatch.key)));
  };

  const replaceCurrentSearchMatch = () => {
    const targetMatch =
      activeSearchMatchIndex === -1
        ? searchMatches[0]
        : searchMatches[activeSearchMatchIndex];

    if (!targetMatch) {
      return;
    }

    const nextRaw = replaceSearchValue(targetMatch.raw, false);

    if (nextRaw === targetMatch.raw) {
      jumpToSearchMatch("next");
      return;
    }

    commitTrackedSheetMutation({
      mutation: () => {
        sheet.setCellByKey(targetMatch.key, nextRaw);
      },
      nextSelection: createCellSelection(parseCellKey(targetMatch.key)),
    });
  };

  const replaceAllSearchMatches = () => {
    if (searchMatches.length === 0) {
      return;
    }

    const replacements = searchMatches
      .map((match) => ({
        key: match.key,
        nextRaw: replaceSearchValue(match.raw, true),
      }))
      .filter((entry) => {
        const currentRaw = sheet.getCellByKey(entry.key)?.raw ?? "";
        return entry.nextRaw !== currentRaw;
      });

    if (replacements.length === 0) {
      return;
    }

    commitTrackedSheetMutation({
      mutation: () => {
        for (const replacement of replacements) {
          sheet.setCellByKey(replacement.key, replacement.nextRaw);
        }
      },
      nextSelection: createCellSelection(parseCellKey(replacements[0].key)),
    });
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
      cancelEditing();
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
      cancelEditing();
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

      <SheetMenuBar
        activeCell={activeCell}
        activeCellAlignment={activeCellAlignment}
        activeCellFormat={activeCellFormat}
        activeFontFamily={activeFontFamily}
        activeFontSize={activeFontSize}
        activeMenu={activeMenu}
        applyFormattingPatch={applyFormattingPatch}
        canRedo={historyRef.current.future.length > 0}
        canUndo={historyRef.current.past.length > 0}
        clearSelectionContents={clearSelectionContents}
        clearSelectionFormatting={clearSelectionFormatting}
        closeMenus={closeMenus}
        copySelectionContents={copySelectionContents}
        cutSelectionContents={cutSelectionContents}
        freezeFirstColumn={freezeFirstColumn}
        freezeTopRow={freezeTopRow}
        handleExport={handleExport}
        insertColumn={insertColumn}
        insertRow={insertRow}
        onBackToDashboard={() => {
          router.push("/dashboard");
        }}
        onToggleMenu={(menuKey) => {
          setActiveMenu((current) => (current === menuKey ? null : menuKey));
        }}
        openRenameDialog={openRenameDialog}
        openSearchPanel={openSearchPanel}
        pasteSelectionContents={pasteSelectionContents}
        redoSelectionChange={redoSelectionChange}
        selectionDimensions={selectionDimensions}
        setActiveHelpPanel={setActiveHelpPanel}
        setFreezeFirstColumn={setFreezeFirstColumn}
        setFreezeTopRow={setFreezeTopRow}
        setShowCrosshairHighlight={setShowCrosshairHighlight}
        setShowFormulaBar={setShowFormulaBar}
        setShowGridlines={setShowGridlines}
        showCrosshairHighlight={showCrosshairHighlight}
        showFormulaBar={showFormulaBar}
        showGridlines={showGridlines}
        sortSelectionRows={sortSelectionRows}
        undoSelectionChange={undoSelectionChange}
        writeStateLabel={formatWriteState(writeState)}
      />

      <SheetToolbar
        activeCell={activeCell}
        activeCellAlignment={activeCellAlignment}
        activeCellFormat={activeCellFormat}
        activeFontFamily={activeFontFamily}
        activeFontSize={activeFontSize}
        applyFormattingPatch={applyFormattingPatch}
        canRedo={historyRef.current.future.length > 0}
        canUndo={historyRef.current.past.length > 0}
        clearSelectionContents={clearSelectionContents}
        clearSelectionFormatting={clearSelectionFormatting}
        copySelectionContents={copySelectionContents}
        cutSelectionContents={cutSelectionContents}
        isSearchPanelOpen={isSearchPanelOpen}
        pasteSelectionContents={pasteSelectionContents}
        redoSelectionChange={redoSelectionChange}
        setIsSearchPanelOpen={setIsSearchPanelOpen}
        sortSelectionRows={sortSelectionRows}
        undoSelectionChange={undoSelectionChange}
      />
      {isSearchPanelOpen ? (
        <SearchPanel
          activeSearchMatchIndex={activeSearchMatchIndex}
          closeSearchPanel={closeSearchPanel}
          isSearchCaseSensitive={isSearchCaseSensitive}
          jumpToSearchMatch={jumpToSearchMatch}
          replaceAllSearchMatches={replaceAllSearchMatches}
          replaceCurrentSearchMatch={replaceCurrentSearchMatch}
          replaceValue={replaceValue}
          searchInputRef={searchInputRef}
          searchMatches={searchMatches}
          searchQuery={searchQuery}
          setIsSearchCaseSensitive={setIsSearchCaseSensitive}
          setReplaceValue={setReplaceValue}
          setSearchQuery={setSearchQuery}
        />
      ) : null}
      <div className="border-[#e0e3e7] border-b bg-[#f8f9fa]">
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
                const nextValue = event.target.value;

                if (
                  editingAddress == null ||
                  editingSurface !== "formula-bar"
                ) {
                  startEditing(activeCell, activeCellRaw, "formula-bar");
                }

                setDraftValue(nextValue);
                setEditorMode(nextValue.startsWith("=") ? "formula" : "edit");
                syncLiveEditValue(activeCell, nextValue);
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
            const isColumnDraggable =
              isSelectedColumn && isFullColumnSelection && !headerDragState;

            return (
              <div
                className={`absolute top-0 h-full ${
                  showGridlines ? "border-[#e0e0e0] border-r" : ""
                }`}
                key={`column-${column}`}
                onPointerDown={(event) => {
                  handleColumnHeaderPointerDown(event, column);
                }}
                style={{
                  backgroundColor: getHeaderBackgroundColor(
                    isActiveColumn,
                    isSelectedColumn
                  ),
                  color: isSelectedColumn ? "#202124" : "#5f6368",
                  cursor: isColumnDraggable ? "grab" : "default",
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
            const isRowDraggable =
              isSelectedRow && isFullRowSelection && !headerDragState;

            return (
              <div
                className={`absolute left-0 ${
                  showGridlines ? "border-[#e0e0e0] border-b" : ""
                }`}
                key={`row-${row}`}
                onPointerDown={(event) => {
                  handleRowHeaderPointerDown(event, row);
                }}
                style={{
                  backgroundColor: getHeaderBackgroundColor(
                    isActiveRow,
                    isSelectedRow
                  ),
                  color: isSelectedRow ? "#202124" : "#5f6368",
                  cursor: isRowDraggable ? "grab" : "default",
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
                    const nextValue = event.target.value;

                    setDraftValue(nextValue);
                    setEditorMode(
                      nextValue.startsWith("=") ? "formula" : "edit"
                    );
                    syncLiveEditValue(editingAddress, nextValue);
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
        <RenameSheetDialog
          onClose={() => {
            setIsRenameDialogOpen(false);
          }}
          onSubmit={() => {
            submitRename().catch(() => undefined);
          }}
          renameDraft={renameDraft}
          setRenameDraft={setRenameDraft}
        />
      ) : null}

      {activeHelpPanel ? (
        <HelpPanelDialog
          activeHelpPanel={activeHelpPanel}
          bounds={bounds}
          documentTitle={document.title}
          onClose={() => {
            setActiveHelpPanel(null);
          }}
          populatedCellCount={sheet.cellCount}
        />
      ) : null}
    </section>
  );
}

"use client";

import {
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
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
import {
  getRenderedCellValue,
  getResolvedHorizontalAlign,
} from "@/features/spreadsheet/cell-formatting";
import { getVisibleWindow } from "@/features/spreadsheet/chunks";
import {
  createDelimitedExport,
  createJsonExport,
} from "@/features/spreadsheet/export";
import {
  createCellSelection,
  createRangeSelection,
  extendSelection,
  getNavigationDelta,
  getSelectionAnchor,
  getSelectionDimensionsForLayout,
  getSelectionMembers,
  getSelectionRect,
  getWriteStateAfterEvent,
  isPrintableCellInput,
  moveCellAddressInLayout,
  parseClipboardMatrix,
  selectionContainsAddress,
  serializeSelectionMatrix,
} from "@/features/spreadsheet/interaction";
import {
  clampColumnWidth,
  clampRowHeight,
  createAxisLayouts,
  getAxisLayoutByLogicalIndex,
  getAxisVisibleSlice,
  moveAxisItem,
} from "@/features/spreadsheet/sheet-layout";
import { SparseSheet } from "@/features/spreadsheet/sparse-sheet";
import {
  DEFAULT_SHEET_METRICS,
  getCellAddressFromPoint,
  getCellLayout,
  getColumnHeaderLabel,
  getGridDimensions,
  getViewportFromScroll,
} from "@/features/spreadsheet/viewport";
import { touchDocument } from "@/lib/metadata/metadata-store";
import type { DocumentMeta, SessionIdentity } from "@/types/metadata";
import type {
  CellAddress,
  CellFontFamily,
  CellFontSize,
  CellFormat,
  CellFormatRecord,
  CellHorizontalAlignment,
  CellRecord,
  ComputedValue,
  Selection,
  Viewport,
} from "@/types/spreadsheet";
import { CELL_FONT_FAMILIES, CELL_FONT_SIZES } from "@/types/spreadsheet";
import type { EditorMode, WriteState } from "@/types/ui";

const DEFAULT_VIEWPORT_WIDTH = 960;
const DEFAULT_VIEWPORT_HEIGHT = 640;
const DEFAULT_SELECTION: CellAddress = {
  col: 1,
  row: 1,
};
const RECONNECT_SETTLE_DELAY_MS = 220;
const WRITE_CONFIRMATION_DELAY_MS = 180;
const CELL_FONT_FAMILY_STYLES: Record<CellFontFamily, string> = {
  display: 'var(--font-display), "Segoe UI", sans-serif',
  mono: 'var(--font-body), "SFMono-Regular", Consolas, monospace',
  sans: '"Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
};

type EditorSurface = "cell" | "formula-bar";
type ReorderAxis = "col" | "row";
type HeaderDragState =
  | {
      axis: ReorderAxis;
      sourceLogicalIndex: number;
      targetLogicalIndex: number;
      type: "reorder";
    }
  | {
      axis: ReorderAxis;
      logicalIndex: number;
      type: "resize";
    };

function createSeededSheet(document: DocumentMeta) {
  const sheet = new SparseSheet();

  sheet.batchPaste({ col: 1, row: 1 }, [
    [document.title, "Owner", document.ownerName, "Status", "Phase 5"],
    [
      "Room",
      document.roomId.slice(0, 12),
      "Modified",
      new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(document.lastModifiedAt),
      "Type, tab, paste, or drag-select",
    ],
    ["Rows", "10,000", "Columns", "100", "Logical cells", "1,000,000"],
  ]);

  sheet.batchPaste({ col: 1, row: 5 }, [
    ["12", "8", "=A5+B5", "=SUM(A5:B5)", "=SUM(A5,C5)"],
    ["Formula input", "Formula input", "A+B", "SUM range", "SUM args"],
  ]);

  sheet.setCell({ col: 1, row: 128 }, "Checkpoint row 128");
  sheet.setCell({ col: 4, row: 512 }, "Checkpoint row 512");
  sheet.setCell({ col: 6, row: 4096 }, "Sparse far field");
  sheet.setCell({ col: 26, row: 9999 }, "Edge probe");

  return sheet;
}

function getCellDisplayValue(cell: CellRecord | null) {
  return cell?.raw ?? "";
}

function getCellKind(raw: string): CellRecord["kind"] {
  if (raw.startsWith("=")) {
    return "formula";
  }

  if (raw.trim() !== "" && Number.isFinite(Number(raw))) {
    return "number";
  }

  return "text";
}

function getSelectionMatrix(
  sheet: SparseSheet,
  columnOrder: number[],
  rowOrder: number[]
) {
  return rowOrder.map((row) =>
    columnOrder.map((col) => getCellDisplayValue(sheet.getCell({ col, row })))
  );
}

function getCellBackgroundColor(args: {
  format: CellFormatRecord | null;
  isActive: boolean;
  isSelected: boolean;
}) {
  if (args.isActive) {
    return args.format?.backgroundColor ?? "rgba(42,118,130,0.08)";
  }

  if (args.isSelected) {
    return args.format?.backgroundColor ?? "rgba(42,118,130,0.04)";
  }

  return args.format?.backgroundColor ?? "rgba(255,255,255,0.72)";
}

function getHeaderBackgroundColor(isActive: boolean, isSelected: boolean) {
  if (isActive) {
    return "rgba(42,118,130,0.18)";
  }

  if (isSelected) {
    return "rgba(42,118,130,0.1)";
  }

  return "transparent";
}

function getToolbarButtonClassName(isActive: boolean) {
  return `rounded-full border px-3 py-2 text-sm transition-colors ${
    isActive
      ? "border-[var(--accent)] bg-[rgba(42,118,130,0.12)] text-[var(--accent)]"
      : "border-[var(--border)] bg-white/80 hover:border-[rgba(42,118,130,0.2)]"
  }`;
}

function getFontFamilyLabel(fontFamily: CellFontFamily) {
  switch (fontFamily) {
    case "display":
      return "Display";
    case "mono":
      return "Mono";
    case "sans":
      return "Sans";
    default:
      return "Serif";
  }
}

function getAlignmentLabel(alignment: CellHorizontalAlignment) {
  switch (alignment) {
    case "center":
      return "Center";
    case "right":
      return "Right";
    default:
      return "Left";
  }
}

function getCellContentStyle(args: {
  cell: CellRecord | null;
  computedValue: ComputedValue | undefined;
  format: CellFormatRecord | null;
  formulaError: string | undefined;
  isActive: boolean;
  isSelected: boolean;
}): CSSProperties {
  return {
    backgroundColor: getCellBackgroundColor({
      format: args.format,
      isActive: args.isActive,
      isSelected: args.isSelected,
    }),
    color: args.formulaError
      ? "#b42318"
      : (args.format?.textColor ?? "var(--foreground)"),
    fontFamily: args.format?.fontFamily
      ? CELL_FONT_FAMILY_STYLES[args.format.fontFamily]
      : undefined,
    fontSize: args.format?.fontSize ? `${args.format.fontSize}px` : undefined,
    fontStyle: args.format?.italic ? "italic" : "normal",
    fontWeight: args.format?.bold ? 700 : 400,
    lineHeight: args.format?.fontSize
      ? `${Math.max(20, args.format.fontSize + 6)}px`
      : undefined,
    textAlign: getResolvedHorizontalAlign({
      cell: args.cell,
      computedValue: args.computedValue,
      format: args.format,
      formulaError: args.formulaError,
    }),
    textDecorationLine: args.format?.underline ? "underline" : "none",
  };
}

function formatWriteState(writeState: WriteState) {
  switch (writeState) {
    case "saving":
      return "Saving...";
    case "saved":
      return "Saved";
    case "reconnecting":
      return "Reconnecting...";
    case "offline":
      return "Offline";
    default:
      return "Idle";
  }
}

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");
}

function downloadExport(filename: string, content: string, mimeType: string) {
  if (typeof window === "undefined") {
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 0);
}

function captureLayoutState(sheet: SparseSheet) {
  return {
    columnOrder: sheet.getColumnOrder(),
    columnWidths: sheet.getColumnWidths(),
    rowHeights: sheet.getRowHeights(),
    rowOrder: sheet.getRowOrder(),
  };
}

function applyRemoteChanges(args: {
  batchUpsert: (cells: Array<{ key: string; raw: string }>) => void;
  changes: CollaborationSheetChangeSet;
  deleteCell: (key: string) => void;
  markCellsDirty: () => void;
  markLayoutDirty: () => void;
  sheet: SparseSheet;
}) {
  let didCellChange = false;
  let didLayoutChange = false;
  const formulaUpserts: Array<{ key: string; raw: string }> = [];

  for (const change of args.changes.cells) {
    if (change.value === null) {
      didCellChange = args.sheet.clearCellByKey(change.key) || didCellChange;
      args.deleteCell(change.key);
      continue;
    }

    args.sheet.setCellByKey(change.key, change.value);
    formulaUpserts.push({
      key: change.key,
      raw: change.value.raw,
    });
    didCellChange = true;
  }

  for (const change of args.changes.formats) {
    if (change.value === null) {
      didCellChange =
        args.sheet.clearCellFormat(parseCellKey(change.key)) || didCellChange;
      continue;
    }

    args.sheet.setCellFormatByKey(change.key, change.value);
    didCellChange = true;
  }

  for (const change of args.changes.columnWidths) {
    args.sheet.setColumnWidth(change.index, change.value);
    didLayoutChange = true;
  }

  for (const change of args.changes.rowHeights) {
    args.sheet.setRowHeight(change.index, change.value);
    didLayoutChange = true;
  }

  if (args.changes.columnOrder) {
    args.sheet.setColumnOrder(args.changes.columnOrder);
    didLayoutChange = true;
  }

  if (args.changes.rowOrder) {
    args.sheet.setRowOrder(args.changes.rowOrder);
    didLayoutChange = true;
  }

  if (formulaUpserts.length > 0) {
    args.batchUpsert(formulaUpserts);
  }

  if (didCellChange) {
    args.markCellsDirty();
  }

  if (didLayoutChange) {
    args.markLayoutDirty();
  }
}

function commitHeaderDrag(args: {
  applyColumnOrder: (order: number[], sync?: boolean) => void;
  applyRowOrder: (order: number[], sync?: boolean) => void;
  headerDragState: HeaderDragState;
  scheduleWriteConfirmation: () => void;
  setColumnWidth: (column: number, width: number | null) => void;
  setRowHeight: (row: number, height: number | null) => void;
  sheet: SparseSheet;
  syncDocumentTimestamp: () => void;
}) {
  if (args.headerDragState.type === "resize") {
    if (args.headerDragState.axis === "col") {
      const width = args.sheet.getColumnWidth(
        args.headerDragState.logicalIndex
      );

      if (width != null) {
        args.setColumnWidth(args.headerDragState.logicalIndex, width);
        args.scheduleWriteConfirmation();
        args.syncDocumentTimestamp();
      }

      return;
    }

    const height = args.sheet.getRowHeight(args.headerDragState.logicalIndex);

    if (height != null) {
      args.setRowHeight(args.headerDragState.logicalIndex, height);
      args.scheduleWriteConfirmation();
      args.syncDocumentTimestamp();
    }

    return;
  }

  if (
    args.headerDragState.sourceLogicalIndex ===
    args.headerDragState.targetLogicalIndex
  ) {
    return;
  }

  if (args.headerDragState.axis === "col") {
    args.applyColumnOrder(
      moveAxisItem(
        args.sheet.getColumnOrder(),
        args.headerDragState.sourceLogicalIndex,
        args.headerDragState.targetLogicalIndex
      ),
      true
    );
    return;
  }

  args.applyRowOrder(
    moveAxisItem(
      args.sheet.getRowOrder(),
      args.headerDragState.sourceLogicalIndex,
      args.headerDragState.targetLogicalIndex
    ),
    true
  );
}

function useVirtualViewport() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingScrollRef = useRef({
    scrollX: 0,
    scrollY: 0,
  });
  const [viewport, setViewport] = useState<Viewport>(() =>
    getViewportFromScroll({
      scrollX: 0,
      scrollY: 0,
      viewportHeight: DEFAULT_VIEWPORT_HEIGHT,
      viewportWidth: DEFAULT_VIEWPORT_WIDTH,
    })
  );

  useEffect(() => {
    const node = scrollRef.current;

    if (!node) {
      return;
    }

    const updateViewport = (
      nextScrollX: number,
      nextScrollY: number,
      nextWidth: number,
      nextHeight: number
    ) => {
      startTransition(() => {
        setViewport(
          getViewportFromScroll({
            scrollX: nextScrollX,
            scrollY: nextScrollY,
            viewportHeight: nextHeight,
            viewportWidth: nextWidth,
          })
        );
      });
    };

    updateViewport(0, 0, node.clientWidth, node.clientHeight);

    const resizeObserver = new ResizeObserver(() => {
      updateViewport(
        pendingScrollRef.current.scrollX,
        pendingScrollRef.current.scrollY,
        node.clientWidth,
        node.clientHeight
      );
    });

    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const handleScroll = () => {
    const node = scrollRef.current;

    if (!node) {
      return;
    }

    pendingScrollRef.current = {
      scrollX: node.scrollLeft,
      scrollY: node.scrollTop,
    };

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      startTransition(() => {
        setViewport(
          getViewportFromScroll({
            scrollX: pendingScrollRef.current.scrollX,
            scrollY: pendingScrollRef.current.scrollY,
            viewportHeight: node.clientHeight,
            viewportWidth: node.clientWidth,
          })
        );
      });
    });
  };

  return {
    handleScroll,
    scrollRef,
    viewport,
  };
}

function VirtualCell({
  address,
  columnLayout,
  computedValue,
  format,
  formulaError,
  isActive,
  isSelected,
  record,
  rowLayout,
}: {
  address: CellAddress;
  columnLayout: import("@/types/spreadsheet").AxisLayout;
  computedValue: ComputedValue | undefined;
  format: CellFormatRecord | null;
  formulaError: string | undefined;
  isActive: boolean;
  isSelected: boolean;
  record: CellRecord | null;
  rowLayout: import("@/types/spreadsheet").AxisLayout;
}) {
  const layout = getCellLayout(address, columnLayout, rowLayout);
  const displayValue = getRenderedCellValue({
    cell: record,
    computedValue,
    formulaError,
  });

  return (
    <div
      className="absolute overflow-hidden border-[var(--border)] border-r border-b px-3 py-2 text-[0.92rem] leading-6"
      style={{
        height: layout.height,
        left: layout.left,
        top: layout.top,
        width: layout.width,
        ...getCellContentStyle({
          cell: record,
          computedValue,
          format,
          formulaError,
          isActive,
          isSelected,
        }),
      }}
      title={formulaError}
    >
      <div className="truncate">{displayValue}</div>
    </div>
  );
}

export function VirtualizedSheet({
  document,
  onWriteStateChange,
  session,
}: {
  document: DocumentMeta;
  onWriteStateChange?: (writeState: WriteState) => void;
  session: SessionIdentity | null;
}) {
  const sheetRef = useRef<SparseSheet | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formulaBarRef = useRef<HTMLInputElement | null>(null);
  const keyboardProxyRef = useRef<HTMLTextAreaElement | null>(null);
  const pointerAnchorRef = useRef<CellAddress | null>(null);
  const isPointerSelectingRef = useRef(false);
  const commitTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const writeStateRef = useRef<WriteState>("idle");
  const [, setCellRevision] = useState(0);
  const [selection, setSelection] = useState<Selection>(() =>
    createCellSelection(DEFAULT_SELECTION)
  );
  const [editorMode, setEditorMode] = useState<EditorMode>("view");
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
  const visibleWindow = getVisibleWindow(
    {
      ...viewport,
      colEnd: visibleColumnsSlice.visualEnd,
      colStart: visibleColumnsSlice.visualStart,
      overscan: DEFAULT_SHEET_METRICS.overscan,
      rowEnd: visibleRowsSlice.visualEnd,
      rowStart: visibleRowsSlice.visualStart,
    },
    bounds
  );
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
    const key = createCellKey(address);

    applyOptimisticCellWrite(address, value);
    syncUpsertCell({
      key,
      raw: value,
    });
    scheduleWriteConfirmation();
    syncDocumentTimestamp();
  };

  const clearSelectionContents = () => {
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

    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === "Tab"
    ) {
      event.preventDefault();
      const delta = getNavigationDelta(event.key, event.shiftKey);
      const nextAddress = moveCellAddressInLayout(
        activeCell,
        delta,
        bounds,
        columnLayout,
        rowLayout
      );

      applySelection(
        event.shiftKey
          ? extendSelection(selection, nextAddress)
          : createCellSelection(nextAddress)
      );
      return;
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      clearSelectionContents();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      applySelection(createCellSelection(activeCell));
      return;
    }

    if (isPrintableCellInput(event)) {
      event.preventDefault();
      startEditing(activeCell, event.key);
    }
  };

  const handleCopy = (
    event: ClipboardEvent<HTMLDivElement | HTMLTextAreaElement>
  ) => {
    event.preventDefault();
    const matrix = getSelectionMatrix(
      sheet,
      selectionMembers.columns,
      selectionMembers.rows
    );
    event.clipboardData.setData("text/plain", serializeSelectionMatrix(matrix));
  };

  const handlePaste = (
    event: ClipboardEvent<HTMLDivElement | HTMLTextAreaElement>
  ) => {
    event.preventDefault();
    const matrix = parseClipboardMatrix(
      event.clipboardData.getData("text/plain")
    );

    if (matrix.length === 0) {
      return;
    }

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
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-white/82 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
      <textarea
        aria-label="Spreadsheet keyboard input"
        autoFocus
        className="absolute h-px w-px overflow-hidden opacity-0"
        onChange={() => {
          // Intentionally no-op; the proxy exists only to receive keyboard events.
        }}
        onCopy={handleCopy}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        readOnly
        ref={keyboardProxyRef}
        spellCheck={false}
        value=""
      />

      <div className="flex items-center justify-between border-[var(--border)] border-b bg-[rgba(247,249,250,0.92)] px-4 py-3 text-[0.72rem] text-[var(--muted)] uppercase tracking-[0.18em]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[rgba(42,118,130,0.08)] px-3 py-1 font-mono text-[var(--accent)]">
            {editorMode === "view" ? "Active" : editorMode}{" "}
            {getColumnHeaderLabel(activeCell.col)}
            {activeCell.row}
          </span>
          <span className="font-mono">
            Visible rows {visibleWindow.rowStart}-{visibleWindow.rowEnd}
          </span>
          <span className="font-mono">
            Selection {selectionDimensions.rowCount}x
            {selectionDimensions.colCount}
          </span>
          <span className="font-mono">Drag grips reorder. Edges resize.</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono">
          <span>{isReady ? "Formulas ready" : "Formulas warming"}</span>
          <span>{status}</span>
          {lastRemoteLatencyMs != null ? (
            <span>remote {lastRemoteLatencyMs}ms</span>
          ) : null}
          {peers.length > 0 ? (
            <span>
              {peers.length} collaborator{peers.length === 1 ? "" : "s"}
            </span>
          ) : null}
          <span>{formatWriteState(writeState)}</span>
          <span>{bounds.rowCount.toLocaleString()} rows</span>
          <span>{bounds.colCount.toLocaleString()} cols</span>
          <span>{sheet.cellCount.toLocaleString()} populated</span>
        </div>
      </div>

      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 border-[var(--border)] border-b bg-[linear-gradient(180deg,_rgba(252,253,253,0.98),_rgba(246,249,250,0.94))] px-4 py-3">
        <div className="rounded-[1rem] border border-[rgba(42,118,130,0.16)] bg-[rgba(42,118,130,0.06)] px-3 py-2 font-mono text-[0.82rem] text-[var(--accent)] uppercase tracking-[0.22em]">
          fx {getColumnHeaderLabel(activeCell.col)}
          {activeCell.row}
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-3 py-2 text-sm">
              Font
              <select
                aria-label="Cell font family"
                className="rounded-full border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm outline-none"
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
            <label className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-3 py-2 text-sm">
              Size
              <select
                aria-label="Cell font size"
                className="rounded-full border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm outline-none"
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
            <button
              className={getToolbarButtonClassName(
                Boolean(activeCellFormat?.bold)
              )}
              onClick={() => {
                applyFormattingPatch({
                  bold: !activeCellFormat?.bold,
                });
              }}
              type="button"
            >
              Bold
            </button>
            <button
              className={getToolbarButtonClassName(
                Boolean(activeCellFormat?.italic)
              )}
              onClick={() => {
                applyFormattingPatch({
                  italic: !activeCellFormat?.italic,
                });
              }}
              type="button"
            >
              Italic
            </button>
            <button
              className={getToolbarButtonClassName(
                Boolean(activeCellFormat?.underline)
              )}
              onClick={() => {
                applyFormattingPatch({
                  underline: !activeCellFormat?.underline,
                });
              }}
              type="button"
            >
              Underline
            </button>
            <label className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-3 py-2 text-sm">
              Text
              <input
                aria-label="Cell text color"
                className="h-7 w-10 rounded-md border border-[var(--border)]"
                onChange={(event) => {
                  applyFormattingPatch({
                    textColor: event.target.value,
                  });
                }}
                type="color"
                value={activeCellFormat?.textColor ?? "#172333"}
              />
            </label>
            <label className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-3 py-2 text-sm">
              Fill
              <input
                aria-label="Cell fill color"
                className="h-7 w-10 rounded-md border border-[var(--border)]"
                onChange={(event) => {
                  applyFormattingPatch({
                    backgroundColor: event.target.value,
                  });
                }}
                type="color"
                value={activeCellFormat?.backgroundColor ?? "#ffffff"}
              />
            </label>
            <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-white/80 p-1">
              {(["left", "center", "right"] as const).map((alignment) => (
                <button
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
                  type="button"
                >
                  {getAlignmentLabel(alignment)}
                </button>
              ))}
            </div>
            <button
              className="rounded-full border border-[var(--border)] bg-white/80 px-3 py-2 text-sm"
              onClick={() => {
                handleExport("csv");
              }}
              type="button"
            >
              Export CSV
            </button>
            <button
              className="rounded-full border border-[var(--border)] bg-white/80 px-3 py-2 text-sm"
              onClick={() => {
                handleExport("tsv");
              }}
              type="button"
            >
              Export TSV
            </button>
            <button
              className="rounded-full border border-[var(--border)] bg-white/80 px-3 py-2 text-sm"
              onClick={() => {
                handleExport("json");
              }}
              type="button"
            >
              Export JSON
            </button>
          </div>
          <div className="flex items-center gap-3 rounded-[1.15rem] border border-[var(--border)] bg-white/88 px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <span className="font-mono text-[0.78rem] text-[var(--muted)] uppercase tracking-[0.24em]">
              Formula
            </span>
            <input
              className="h-9 w-full bg-transparent text-[0.96rem] text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
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
              placeholder="Type a value or formula like =SUM(A5:B5)"
              ref={formulaBarRef}
              value={formulaBarValue}
            />
            <div className="flex flex-wrap items-center gap-2">
              {peers.map((peer) => (
                <span
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(248,250,251,0.92)] px-3 py-1 text-[0.78rem] text-[var(--foreground)]"
                  key={peer.userId}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: peer.color }}
                  />
                  {peer.displayName}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[4.5rem_minmax(0,1fr)] grid-rows-[3rem_minmax(0,1fr)] bg-[linear-gradient(180deg,_rgba(251,252,252,0.95),_rgba(244,247,248,0.92))]">
        <div className="border-[var(--border)] border-r border-b bg-[rgba(236,241,244,0.92)] px-3 py-3 font-mono text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.28em]">
          Grid
        </div>

        <div className="relative overflow-hidden border-[var(--border)] border-b bg-[rgba(236,241,244,0.92)]">
          {visibleColumns.map((column) => {
            const layout = getAxisLayoutByLogicalIndex(columnLayout, column);
            const left = layout.start - viewport.scrollX;
            const isSelectedColumn = selectedColumnSet.has(column);
            const isActiveColumn = column === activeCell.col;

            return (
              <div
                className="absolute top-0 h-full border-[var(--border)] border-r"
                key={`column-${column}`}
                style={{
                  backgroundColor: getHeaderBackgroundColor(
                    isActiveColumn,
                    isSelectedColumn
                  ),
                  color: isSelectedColumn
                    ? "var(--foreground)"
                    : "var(--muted)",
                  left,
                  width: layout.size,
                }}
              >
                <div className="flex h-full items-center gap-2 px-2 font-mono text-[0.76rem] uppercase tracking-[0.22em]">
                  <button
                    aria-label={`Reorder column ${getColumnHeaderLabel(column)}`}
                    className="rounded-md px-1 text-[0.8rem] text-[var(--muted)] hover:bg-white/70"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setHeaderDragState({
                        axis: "col",
                        sourceLogicalIndex: column,
                        targetLogicalIndex: column,
                        type: "reorder",
                      });
                    }}
                    type="button"
                  >
                    ::
                  </button>
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

        <div className="relative overflow-hidden border-[var(--border)] border-r bg-[rgba(248,249,250,0.92)]">
          {visibleRows.map((row) => {
            const layout = getAxisLayoutByLogicalIndex(rowLayout, row);
            const top = layout.start - viewport.scrollY;
            const isSelectedRow = selectedRowSet.has(row);
            const isActiveRow = row === activeCell.row;

            return (
              <div
                className="absolute left-0 border-[var(--border)] border-b"
                key={`row-${row}`}
                style={{
                  backgroundColor: getHeaderBackgroundColor(
                    isActiveRow,
                    isSelectedRow
                  ),
                  color: isSelectedRow ? "var(--foreground)" : "var(--muted)",
                  height: layout.size,
                  top,
                  width: "100%",
                }}
              >
                <div className="flex h-full items-center gap-2 px-2 font-mono text-[0.75rem] tracking-[0.18em]">
                  <button
                    aria-label={`Reorder row ${row}`}
                    className="rounded-md px-1 text-[0.8rem] text-[var(--muted)] hover:bg-white/70"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setHeaderDragState({
                        axis: "row",
                        sourceLogicalIndex: row,
                        targetLogicalIndex: row,
                        type: "reorder",
                      });
                    }}
                    type="button"
                  >
                    ::
                  </button>
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
          className="relative overflow-auto bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(249,251,252,0.98))] outline-none"
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
                  isSelected={selectionContainsAddress(
                    selection,
                    { col: column, row },
                    columnLayout,
                    rowLayout
                  )}
                  key={`${row}:${column}`}
                  record={sheet.getCell({ col: column, row })}
                  rowLayout={rowLayout}
                />
              ))
            )}

            <div
              className="pointer-events-none absolute rounded-[0.85rem] bg-[rgba(42,118,130,0.07)]"
              style={{
                height: selectionRect.height,
                left: selectionRect.left,
                top: selectionRect.top,
                width: selectionRect.width,
              }}
            />

            <div
              className="pointer-events-none absolute rounded-[0.85rem] border-2 border-[var(--accent)] shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
              style={{
                height: selectionRect.height,
                left: selectionRect.left,
                top: selectionRect.top,
                width: selectionRect.width,
              }}
            />

            <div
              className="pointer-events-none absolute rounded-[0.7rem] border-2 border-[var(--foreground)]"
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
                      className="pointer-events-none absolute rounded-[0.8rem] border-2"
                      style={{
                        borderColor: peer.color,
                        height: peerSelectionRect.height,
                        left: peerSelectionRect.left,
                        top: peerSelectionRect.top,
                        width: peerSelectionRect.width,
                      }}
                    />
                  ) : null}
                  {peerActiveCell ? (
                    <div
                      className="pointer-events-none absolute rounded-[0.7rem] border-2"
                      style={{
                        borderColor: peer.color,
                        height: getCellLayout(
                          peerActiveCell,
                          columnLayout,
                          rowLayout
                        ).height,
                        left: getCellLayout(
                          peerActiveCell,
                          columnLayout,
                          rowLayout
                        ).left,
                        top: getCellLayout(
                          peerActiveCell,
                          columnLayout,
                          rowLayout
                        ).top,
                        width: getCellLayout(
                          peerActiveCell,
                          columnLayout,
                          rowLayout
                        ).width,
                      }}
                    />
                  ) : null}
                </div>
              );
            })}

            {headerDragState?.type === "reorder" &&
            headerDragState.axis === "col" ? (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-20 w-[3px] rounded-full bg-[var(--accent)]"
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
                className="pointer-events-none absolute right-0 left-0 z-20 h-[3px] rounded-full bg-[var(--accent)]"
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
                className="absolute z-20 rounded-[0.75rem] border-2 border-[var(--accent)] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
                style={{
                  height: activeCellLayout.height,
                  left: activeCellLayout.left,
                  top: activeCellLayout.top,
                  width: activeCellLayout.width,
                }}
              >
                <input
                  className="h-full w-full bg-transparent px-3 py-2 text-[0.92rem] text-[var(--foreground)] outline-none"
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
    </section>
  );
}

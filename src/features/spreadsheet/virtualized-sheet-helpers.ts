import type { CSSProperties } from "react";
import type { CollaborationSheetChangeSet } from "@/features/collaboration/use-collaboration-room";
import { parseCellKey } from "@/features/spreadsheet/addressing";
import { getResolvedHorizontalAlign } from "@/features/spreadsheet/cell-formatting";
import { moveAxisItem } from "@/features/spreadsheet/sheet-layout";
import { SparseSheet } from "@/features/spreadsheet/sparse-sheet";
import type { DocumentMeta } from "@/types/metadata";
import type {
  CellFontFamily,
  CellFormatRecord,
  CellHorizontalAlignment,
  CellRecord,
  ComputedValue,
} from "@/types/spreadsheet";
import type { WriteState } from "@/types/ui";
import type { SparseSheetSnapshot } from "./sparse-sheet";
import type {
  HeaderDragState,
  HelpPanel,
  KeyedChange,
  NumericChange,
  SnapshotChanges,
} from "./virtualized-sheet-types";

const CELL_FONT_FAMILY_STYLES: Record<CellFontFamily, string> = {
  display: 'var(--font-display), "Segoe UI", sans-serif',
  mono: 'var(--font-body), "SFMono-Regular", Consolas, monospace',
  sans: '"Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
};

export function createSeededSheet(document: DocumentMeta) {
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

export function getCellDisplayValue(cell: CellRecord | null) {
  return cell?.raw ?? "";
}

export function getCellKind(raw: string): CellRecord["kind"] {
  if (raw.startsWith("=")) {
    return "formula";
  }

  if (raw.trim() !== "" && Number.isFinite(Number(raw))) {
    return "number";
  }

  return "text";
}

export function getSelectionMatrix(
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
    return args.format?.backgroundColor ?? "rgba(37, 99, 235, 0.08)";
  }

  if (args.isSelected) {
    return args.format?.backgroundColor ?? "rgba(37, 99, 235, 0.04)";
  }

  return args.format?.backgroundColor ?? "#ffffff";
}

export function getHeaderBackgroundColor(
  isActive: boolean,
  isSelected: boolean
) {
  if (isActive) {
    return "#c8d7e8";
  }

  if (isSelected) {
    return "#d8e5f4";
  }

  return "#f8f9fa";
}

export function getToolbarButtonClassName(isActive: boolean) {
  return `flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[0.75rem] transition-all ${
    isActive
      ? "bg-[#d3e3fd] text-[#041e49] shadow-[inset_0_0_0_1px_#aecbfa]"
      : "bg-white text-[#444746] shadow-[inset_0_0_0_1px_#dadce0] hover:bg-[#f7f9fc]"
  }`;
}

export function getFontFamilyLabel(fontFamily: CellFontFamily) {
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

export function getAlignmentLabel(alignment: CellHorizontalAlignment) {
  switch (alignment) {
    case "center":
      return "Center";
    case "right":
      return "Right";
    default:
      return "Left";
  }
}

export function getHelpPanelTitle(activeHelpPanel: HelpPanel) {
  switch (activeHelpPanel) {
    case "formulas":
      return "Formula examples";
    case "shortcuts":
      return "Keyboard shortcuts";
    default:
      return "About this sheet";
  }
}

export function getCellContentStyle(args: {
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

function areArraysEqual(left: number[], right: number[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => right[index] === value)
  );
}

function areRecordsEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function collectKeyedChanges<T>(args: {
  next: Map<string, T>;
  previous: Map<string, T>;
}) {
  const changes: KeyedChange<T>[] = [];

  for (const [key, value] of args.next) {
    if (!areRecordsEqual(args.previous.get(key), value)) {
      changes.push({
        key,
        value,
      });
    }
  }

  for (const key of args.previous.keys()) {
    if (!args.next.has(key)) {
      changes.push({
        key,
        value: null,
      });
    }
  }

  return changes;
}

function collectNumericChanges(args: {
  next: Map<number, number>;
  previous: Map<number, number>;
}) {
  const changes: NumericChange[] = [];

  for (const [index, value] of args.next) {
    if (args.previous.get(index) !== value) {
      changes.push({
        index,
        value,
      });
    }
  }

  for (const index of args.previous.keys()) {
    if (!args.next.has(index)) {
      changes.push({
        index,
        value: null,
      });
    }
  }

  return changes;
}

export function getSnapshotChanges(
  previous: SparseSheetSnapshot,
  next: SparseSheetSnapshot
): SnapshotChanges {
  return {
    cells: collectKeyedChanges({
      next: next.cells,
      previous: previous.cells,
    }),
    columnOrderChanged: !areArraysEqual(previous.columnOrder, next.columnOrder),
    columnWidths: collectNumericChanges({
      next: next.columnWidths,
      previous: previous.columnWidths,
    }),
    formats: collectKeyedChanges({
      next: next.formats,
      previous: previous.formats,
    }),
    rowHeights: collectNumericChanges({
      next: next.rowHeights,
      previous: previous.rowHeights,
    }),
    rowOrderChanged: !areArraysEqual(previous.rowOrder, next.rowOrder),
  };
}

export function hasSnapshotChanges(
  changes: SnapshotChanges,
  previous: SparseSheetSnapshot,
  next: SparseSheetSnapshot
) {
  return (
    changes.cells.length > 0 ||
    changes.columnOrderChanged ||
    changes.columnWidths.length > 0 ||
    changes.formats.length > 0 ||
    changes.rowHeights.length > 0 ||
    changes.rowOrderChanged ||
    !areArraysEqual(previous.columnOrder, next.columnOrder) ||
    !areArraysEqual(previous.rowOrder, next.rowOrder)
  );
}

export function formatWriteState(writeState: WriteState) {
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

export function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");
}

export function downloadExport(
  filename: string,
  content: string,
  mimeType: string
) {
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

export function captureLayoutState(sheet: SparseSheet) {
  return {
    columnOrder: sheet.getColumnOrder(),
    columnWidths: sheet.getColumnWidths(),
    rowHeights: sheet.getRowHeights(),
    rowOrder: sheet.getRowOrder(),
  };
}

export function applyRemoteChanges(args: {
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

export function commitHeaderDrag(args: {
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

import type { CSSProperties } from "react";
import type { CollaborationSheetChangeSet } from "@/features/collaboration/use-collaboration-room";
import { parseCellKey } from "@/features/spreadsheet/addressing";
import { getResolvedHorizontalAlign } from "@/features/spreadsheet/cell-formatting";
import { moveAxisItem } from "@/features/spreadsheet/sheet-layout";
import { SparseSheet } from "@/features/spreadsheet/sparse-sheet";
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

export type SortDirection = "asc" | "desc";

export interface SearchMatch {
  key: string;
  raw: string;
}

const CELL_FONT_FAMILY_STYLES: Record<CellFontFamily, string> = {
  display: 'var(--font-display), "Segoe UI", sans-serif',
  mono: 'var(--font-body), "SFMono-Regular", Consolas, monospace',
  sans: '"Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
};

export function createSeededSheet() {
  return new SparseSheet();
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
  return `flex h-7 min-w-7 items-center justify-center px-[0.375rem] text-[0.8125rem] transition-colors ${
    isActive
      ? "bg-[#e8f0fe] text-[#1a73e8]"
      : "bg-transparent text-[#444746] hover:bg-[#f1f3f4]"
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

function compareCellValues(
  left: string,
  right: string,
  direction: SortDirection
) {
  const leftValue = left.trim();
  const rightValue = right.trim();

  if (leftValue === "" && rightValue === "") {
    return 0;
  }

  if (leftValue === "") {
    return 1;
  }

  if (rightValue === "") {
    return -1;
  }

  const leftNumber = Number(leftValue);
  const rightNumber = Number(rightValue);
  const areNumbers =
    Number.isFinite(leftNumber) && Number.isFinite(rightNumber);

  if (areNumbers) {
    return direction === "asc"
      ? leftNumber - rightNumber
      : rightNumber - leftNumber;
  }

  const comparison = leftValue.localeCompare(rightValue, undefined, {
    numeric: true,
    sensitivity: "base",
  });

  return direction === "asc" ? comparison : comparison * -1;
}

export function sortRowsByColumn(args: {
  direction: SortDirection;
  preserveFirstRow?: boolean;
  rowOrder: number[];
  rows: number[];
  sheet: SparseSheet;
  sortColumn: number;
}) {
  const candidateRows =
    args.preserveFirstRow && args.rows.includes(1)
      ? args.rows.filter((row) => row !== 1)
      : args.rows;

  if (candidateRows.length < 2) {
    return args.rowOrder;
  }

  const originalIndexes = new Map(
    candidateRows.map((row, index) => [row, index] as const)
  );
  const sortedRows = [...candidateRows].sort((leftRow, rightRow) => {
    const comparison = compareCellValues(
      args.sheet.getCell({ col: args.sortColumn, row: leftRow })?.raw ?? "",
      args.sheet.getCell({ col: args.sortColumn, row: rightRow })?.raw ?? "",
      args.direction
    );

    if (comparison !== 0) {
      return comparison;
    }

    return (
      (originalIndexes.get(leftRow) ?? 0) - (originalIndexes.get(rightRow) ?? 0)
    );
  });
  const candidateRowSet = new Set(candidateRows);
  let sortedIndex = 0;

  return args.rowOrder.map((row) => {
    if (!candidateRowSet.has(row)) {
      return row;
    }

    const nextRow = sortedRows[sortedIndex];
    sortedIndex += 1;
    return nextRow;
  });
}

export function findCellMatches(args: {
  caseSensitive?: boolean;
  cells?: Map<string, CellRecord>;
  query: string;
  sheet?: SparseSheet;
}) {
  const normalizedQuery = args.caseSensitive
    ? args.query
    : args.query.toLowerCase();

  if (normalizedQuery.trim() === "") {
    return [] satisfies SearchMatch[];
  }

  const matches: SearchMatch[] = [];

  for (const [key, cell] of args.cells ?? args.sheet?.getCells() ?? new Map()) {
    const haystack = args.caseSensitive ? cell.raw : cell.raw.toLowerCase();

    if (haystack.includes(normalizedQuery)) {
      matches.push({
        key,
        raw: cell.raw,
      });
    }
  }

  return matches.sort((left, right) => {
    const leftAddress = parseCellKey(left.key);
    const rightAddress = parseCellKey(right.key);

    if (leftAddress.row !== rightAddress.row) {
      return leftAddress.row - rightAddress.row;
    }

    return leftAddress.col - rightAddress.col;
  });
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

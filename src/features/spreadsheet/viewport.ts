import {
  assertAddressWithinBounds,
  columnNumberToLetters,
} from "@/features/spreadsheet/addressing";
import type {
  CellAddress,
  SheetBounds,
  SheetMetrics,
  Viewport,
} from "@/types/spreadsheet";

export const DEFAULT_SHEET_METRICS: SheetMetrics = {
  colWidth: 152,
  overscan: 3,
  rowHeaderWidth: 72,
  rowHeight: 46,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getViewportFromScroll(
  args: {
    scrollX: number;
    scrollY: number;
    viewportHeight: number;
    viewportWidth: number;
  },
  bounds: SheetBounds,
  metrics: SheetMetrics = DEFAULT_SHEET_METRICS
): Viewport {
  const safeViewportWidth = Math.max(1, args.viewportWidth);
  const safeViewportHeight = Math.max(1, args.viewportHeight);
  const visibleColumnCount = Math.ceil(safeViewportWidth / metrics.colWidth);
  const visibleRowCount = Math.ceil(safeViewportHeight / metrics.rowHeight);
  const colStart = clamp(
    Math.floor(args.scrollX / metrics.colWidth) + 1,
    1,
    bounds.colCount
  );
  const rowStart = clamp(
    Math.floor(args.scrollY / metrics.rowHeight) + 1,
    1,
    bounds.rowCount
  );

  return {
    colEnd: clamp(colStart + visibleColumnCount - 1, 1, bounds.colCount),
    colStart,
    overscan: metrics.overscan,
    rowEnd: clamp(rowStart + visibleRowCount - 1, 1, bounds.rowCount),
    rowStart,
    scrollX: args.scrollX,
    scrollY: args.scrollY,
    viewportHeight: safeViewportHeight,
    viewportWidth: safeViewportWidth,
  };
}

export function getCellAddressFromPoint(
  point: {
    x: number;
    y: number;
  },
  bounds: SheetBounds,
  metrics: SheetMetrics = DEFAULT_SHEET_METRICS
) {
  const address: CellAddress = {
    col: clamp(Math.floor(point.x / metrics.colWidth) + 1, 1, bounds.colCount),
    row: clamp(Math.floor(point.y / metrics.rowHeight) + 1, 1, bounds.rowCount),
  };

  assertAddressWithinBounds(address, bounds);
  return address;
}

export function getCellLayout(
  address: CellAddress,
  metrics: SheetMetrics = DEFAULT_SHEET_METRICS
) {
  return {
    height: metrics.rowHeight,
    left: (address.col - 1) * metrics.colWidth,
    top: (address.row - 1) * metrics.rowHeight,
    width: metrics.colWidth,
  };
}

export function getColumnHeaderLabel(columnNumber: number) {
  return columnNumberToLetters(columnNumber);
}

export function getGridDimensions(
  bounds: SheetBounds,
  metrics: SheetMetrics = DEFAULT_SHEET_METRICS
) {
  return {
    height: bounds.rowCount * metrics.rowHeight,
    width: bounds.colCount * metrics.colWidth,
  };
}

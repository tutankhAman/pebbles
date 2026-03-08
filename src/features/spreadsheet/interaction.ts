import {
  assertAddressWithinBounds,
  normalizeRange,
} from "@/features/spreadsheet/addressing";
import type {
  AxisLayout,
  CellAddress,
  Selection,
  SheetBounds,
} from "@/types/spreadsheet";
import type { WriteState } from "@/types/ui";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function moveCellAddress(
  address: CellAddress,
  delta: {
    col: number;
    row: number;
  },
  bounds: SheetBounds
) {
  const nextAddress = {
    col: clamp(address.col + delta.col, 1, bounds.colCount),
    row: clamp(address.row + delta.row, 1, bounds.rowCount),
  };

  assertAddressWithinBounds(nextAddress, bounds);
  return nextAddress;
}

export function moveCellAddressInLayout(
  address: CellAddress,
  delta: {
    col: number;
    row: number;
  },
  bounds: SheetBounds,
  columnLayout: AxisLayout,
  rowLayout: AxisLayout
) {
  const nextVisualColumn = clamp(
    columnLayout.logicalToVisual[address.col] + delta.col,
    1,
    bounds.colCount
  );
  const nextVisualRow = clamp(
    rowLayout.logicalToVisual[address.row] + delta.row,
    1,
    bounds.rowCount
  );
  const nextAddress = {
    col: columnLayout.order[nextVisualColumn - 1],
    row: rowLayout.order[nextVisualRow - 1],
  };

  assertAddressWithinBounds(nextAddress, bounds);
  return nextAddress;
}

export function createCellSelection(address: CellAddress): Selection {
  return {
    anchor: address,
    type: "cell",
  };
}

export function createRangeSelection(
  start: CellAddress,
  end: CellAddress
): Selection {
  return {
    end,
    start,
    type: "range",
  };
}

export function getSelectionAnchor(selection: Selection) {
  return selection.type === "cell" ? selection.anchor : selection.start;
}

export function getSelectionFocus(selection: Selection) {
  return selection.type === "cell" ? selection.anchor : selection.end;
}

export function getSelectionBounds(selection: Selection) {
  if (selection.type === "cell") {
    return {
      end: selection.anchor,
      start: selection.anchor,
    };
  }

  return normalizeRange(selection.start, selection.end);
}

export function extendSelection(
  selection: Selection,
  nextFocus: CellAddress
): Selection {
  return createRangeSelection(getSelectionAnchor(selection), nextFocus);
}

function getVisualIndexRange(
  axis: AxisLayout,
  startLogicalIndex: number,
  endLogicalIndex: number
) {
  const startVisualIndex = axis.logicalToVisual[startLogicalIndex];
  const endVisualIndex = axis.logicalToVisual[endLogicalIndex];

  return {
    end: Math.max(startVisualIndex, endVisualIndex),
    start: Math.min(startVisualIndex, endVisualIndex),
  };
}

export function getSelectionMembers(
  selection: Selection,
  columnLayout: AxisLayout,
  rowLayout: AxisLayout
) {
  const anchor = getSelectionAnchor(selection);
  const focus = getSelectionFocus(selection);
  const columnRange = getVisualIndexRange(columnLayout, anchor.col, focus.col);
  const rowRange = getVisualIndexRange(rowLayout, anchor.row, focus.row);

  return {
    columns: columnLayout.order.slice(columnRange.start - 1, columnRange.end),
    rows: rowLayout.order.slice(rowRange.start - 1, rowRange.end),
  };
}

export function getSelectionRect(
  selection: Selection,
  columnLayout: AxisLayout,
  rowLayout: AxisLayout
) {
  const members = getSelectionMembers(selection, columnLayout, rowLayout);
  const firstColumn = members.columns[0];
  const lastColumn = members.columns.at(-1);
  const firstRow = members.rows[0];
  const lastRow = members.rows.at(-1);

  if (
    firstColumn == null ||
    lastColumn == null ||
    firstRow == null ||
    lastRow == null
  ) {
    return {
      height: 0,
      left: 0,
      top: 0,
      width: 0,
    };
  }

  const firstColumnVisual = columnLayout.logicalToVisual[firstColumn];
  const lastColumnVisual = columnLayout.logicalToVisual[lastColumn];
  const firstRowVisual = rowLayout.logicalToVisual[firstRow];
  const lastRowVisual = rowLayout.logicalToVisual[lastRow];
  const left = columnLayout.starts[firstColumnVisual];
  const top = rowLayout.starts[firstRowVisual];

  return {
    height:
      rowLayout.starts[lastRowVisual] + rowLayout.sizes[lastRowVisual] - top,
    left,
    top,
    width:
      columnLayout.starts[lastColumnVisual] +
      columnLayout.sizes[lastColumnVisual] -
      left,
  };
}

export function selectionContainsAddress(
  selection: Selection,
  address: CellAddress,
  columnLayout?: AxisLayout,
  rowLayout?: AxisLayout
) {
  if (columnLayout && rowLayout) {
    const members = getSelectionMembers(selection, columnLayout, rowLayout);

    return (
      members.columns.includes(address.col) &&
      members.rows.includes(address.row)
    );
  }

  const bounds = getSelectionBounds(selection);

  return (
    address.row >= bounds.start.row &&
    address.row <= bounds.end.row &&
    address.col >= bounds.start.col &&
    address.col <= bounds.end.col
  );
}

export function getSelectionDimensions(selection: Selection) {
  const bounds = getSelectionBounds(selection);

  return {
    colCount: bounds.end.col - bounds.start.col + 1,
    rowCount: bounds.end.row - bounds.start.row + 1,
  };
}

export function getSelectionDimensionsForLayout(
  selection: Selection,
  columnLayout: AxisLayout,
  rowLayout: AxisLayout
) {
  const members = getSelectionMembers(selection, columnLayout, rowLayout);

  return {
    colCount: members.columns.length,
    rowCount: members.rows.length,
  };
}

export function parseClipboardMatrix(clipboardText: string) {
  return clipboardText
    .replace(/\r\n/gu, "\n")
    .split("\n")
    .filter((row, index, rows) => row !== "" || index < rows.length - 1)
    .map((row) => row.split("\t"));
}

export function serializeSelectionMatrix(matrix: string[][]) {
  return matrix.map((row) => row.join("\t")).join("\n");
}

export function getWriteStateAfterEvent(
  current: WriteState,
  event:
    | "flush-confirmed"
    | "flush-queued"
    | "network-offline"
    | "network-online"
) {
  switch (event) {
    case "flush-queued":
      return current === "offline" ? "offline" : "saving";
    case "flush-confirmed":
      return current === "offline" ? "offline" : "saved";
    case "network-offline":
      return "offline";
    case "network-online":
      return current === "saving" ? "saving" : "reconnecting";
    default:
      return current;
  }
}

export function getNavigationDelta(
  key: "ArrowDown" | "ArrowLeft" | "ArrowRight" | "ArrowUp" | "Enter" | "Tab",
  shiftKey: boolean
) {
  if (key === "ArrowLeft") {
    return { col: -1, row: 0 };
  }

  if (key === "ArrowRight") {
    return { col: 1, row: 0 };
  }

  if (key === "ArrowUp") {
    return { col: 0, row: -1 };
  }

  if (key === "ArrowDown") {
    return { col: 0, row: 1 };
  }

  if (key === "Enter") {
    return { col: 0, row: shiftKey ? -1 : 1 };
  }

  return { col: shiftKey ? -1 : 1, row: 0 };
}

export function isPrintableCellInput(event: {
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
}) {
  return (
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.metaKey &&
    event.key !== "\t"
  );
}

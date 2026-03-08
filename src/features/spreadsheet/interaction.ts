import {
  assertAddressWithinBounds,
  normalizeRange,
} from "@/features/spreadsheet/addressing";
import type { CellAddress, Selection, SheetBounds } from "@/types/spreadsheet";
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
  const normalized = normalizeRange(start, end);

  return {
    end: normalized.end,
    start: normalized.start,
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

export function selectionContainsAddress(
  selection: Selection,
  address: CellAddress
) {
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

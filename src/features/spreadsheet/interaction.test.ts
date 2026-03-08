import assert from "node:assert/strict";
import test from "node:test";
import {
  createCellSelection,
  extendSelection,
  getNavigationDelta,
  getSelectionBounds,
  getSelectionDimensions,
  getWriteStateAfterEvent,
  isPrintableCellInput,
  moveCellAddress,
  parseClipboardMatrix,
  selectionContainsAddress,
  serializeSelectionMatrix,
} from "@/features/spreadsheet/interaction";
import type { SheetBounds } from "@/types/spreadsheet";

const bounds: SheetBounds = {
  colCount: 100,
  rowCount: 10_000,
};

test("moves the active cell within sheet bounds", () => {
  assert.deepEqual(
    moveCellAddress(
      { col: 1, row: 1 },
      {
        col: -1,
        row: -1,
      },
      bounds
    ),
    { col: 1, row: 1 }
  );

  assert.deepEqual(
    moveCellAddress(
      { col: 4, row: 7 },
      {
        col: 1,
        row: -2,
      },
      bounds
    ),
    { col: 5, row: 5 }
  );
});

test("extends a cell selection into a rectangular range", () => {
  const selection = extendSelection(createCellSelection({ col: 3, row: 4 }), {
    col: 5,
    row: 2,
  });

  assert.deepEqual(getSelectionBounds(selection), {
    end: { col: 5, row: 4 },
    start: { col: 3, row: 2 },
  });
  assert.deepEqual(getSelectionDimensions(selection), {
    colCount: 3,
    rowCount: 3,
  });
  assert.equal(selectionContainsAddress(selection, { col: 4, row: 3 }), true);
  assert.equal(selectionContainsAddress(selection, { col: 6, row: 3 }), false);
});

test("parses and serializes tabular clipboard data", () => {
  const matrix = parseClipboardMatrix("A\tB\n1\t2\n");

  assert.deepEqual(matrix, [
    ["A", "B"],
    ["1", "2"],
  ]);
  assert.equal(serializeSelectionMatrix(matrix), "A\tB\n1\t2");
});

test("transitions write state around local writes and network changes", () => {
  assert.equal(getWriteStateAfterEvent("idle", "flush-queued"), "saving");
  assert.equal(getWriteStateAfterEvent("saving", "flush-confirmed"), "saved");
  assert.equal(getWriteStateAfterEvent("saved", "network-offline"), "offline");
  assert.equal(
    getWriteStateAfterEvent("offline", "network-online"),
    "reconnecting"
  );
});

test("computes spreadsheet-like navigation deltas", () => {
  assert.deepEqual(getNavigationDelta("ArrowRight", false), {
    col: 1,
    row: 0,
  });
  assert.deepEqual(getNavigationDelta("Enter", true), {
    col: 0,
    row: -1,
  });
  assert.deepEqual(getNavigationDelta("Tab", false), {
    col: 1,
    row: 0,
  });
});

test("detects printable key presses that should open the editor", () => {
  assert.equal(
    isPrintableCellInput({
      ctrlKey: false,
      key: "a",
      metaKey: false,
    }),
    true
  );

  assert.equal(
    isPrintableCellInput({
      ctrlKey: true,
      key: "v",
      metaKey: false,
    }),
    false
  );
});

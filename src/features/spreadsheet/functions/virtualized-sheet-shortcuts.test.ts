import assert from "node:assert/strict";
import test from "node:test";
import type { KeyboardEvent } from "react";
import { handleNavigationShortcuts } from "@/features/spreadsheet/functions/virtualized-sheet-shortcuts";
import { createCellSelection } from "@/features/spreadsheet/interaction";
import type { AxisLayout, CellAddress, SheetBounds } from "@/types/spreadsheet";

const TEST_BOUNDS: SheetBounds = {
  colCount: 20,
  rowCount: 100,
};

const TEST_AXIS_LAYOUT: AxisLayout = {
  count: 20,
  defaultSize: 80,
  logicalToVisual: Array.from({ length: 20 }, (_, index) => index),
  order: Array.from({ length: 20 }, (_, index) => index + 1),
  sizes: Array.from({ length: 20 }, () => 80),
  starts: Array.from({ length: 20 }, (_, index) => index * 80),
  totalSize: 1600,
};

test("typing into a selected cell starts editing without replacing the first typed character", () => {
  const activeCell: CellAddress = {
    col: 3,
    row: 4,
  };
  let prevented = false;
  let typedEditArgs: {
    address: CellAddress;
    initialValue: string;
  } | null = null;

  const handled = handleNavigationShortcuts({
    activeCell,
    applySelection: () => undefined,
    bounds: TEST_BOUNDS,
    clearSelectionContents: () => undefined,
    columnLayout: TEST_AXIS_LAYOUT,
    event: {
      ctrlKey: false,
      key: "a",
      metaKey: false,
      preventDefault: () => {
        prevented = true;
      },
      shiftKey: false,
    } as KeyboardEvent<HTMLTextAreaElement>,
    rowLayout: TEST_AXIS_LAYOUT,
    selection: createCellSelection(activeCell),
    startTypingEdit: (address, initialValue) => {
      typedEditArgs = {
        address,
        initialValue,
      };
    },
  });

  assert.equal(handled, true);
  assert.equal(prevented, true);
  assert.deepEqual(typedEditArgs, {
    address: activeCell,
    initialValue: "a",
  });
});

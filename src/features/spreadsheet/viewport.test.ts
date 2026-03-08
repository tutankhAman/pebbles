import assert from "node:assert/strict";
import test from "node:test";
import {
  getCellAddressFromPoint,
  getCellLayout,
  getGridDimensions,
  getViewportFromScroll,
} from "@/features/spreadsheet/viewport";
import type { SheetBounds } from "@/types/spreadsheet";

const bounds: SheetBounds = {
  colCount: 100,
  rowCount: 10_000,
};

test("computes a visible viewport from scroll offsets", () => {
  const viewport = getViewportFromScroll(
    {
      scrollX: 304,
      scrollY: 92,
      viewportHeight: 460,
      viewportWidth: 608,
    },
    bounds
  );

  assert.equal(viewport.colStart, 3);
  assert.equal(viewport.colEnd, 6);
  assert.equal(viewport.rowStart, 3);
  assert.equal(viewport.rowEnd, 12);
});

test("maps pointer coordinates to bounded cell addresses", () => {
  assert.deepEqual(getCellAddressFromPoint({ x: 0, y: 0 }, bounds), {
    col: 1,
    row: 1,
  });
  assert.deepEqual(getCellAddressFromPoint({ x: 305, y: 91 }, bounds), {
    col: 3,
    row: 2,
  });
});

test("returns layout coordinates for a given cell", () => {
  assert.deepEqual(getCellLayout({ col: 4, row: 5 }), {
    height: 46,
    left: 456,
    top: 184,
    width: 152,
  });
});

test("computes full logical grid dimensions without allocating the grid", () => {
  assert.deepEqual(getGridDimensions(bounds), {
    height: 460_000,
    width: 15_200,
  });
});

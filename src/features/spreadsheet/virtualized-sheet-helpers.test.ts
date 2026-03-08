import assert from "node:assert/strict";
import test from "node:test";
import { SparseSheet } from "@/features/spreadsheet/sparse-sheet";
import {
  findCellMatches,
  sortRowsByColumn,
} from "@/features/spreadsheet/virtualized-sheet-helpers";

test("sortRowsByColumn reorders a targeted row range and keeps the header row fixed", () => {
  const sheet = new SparseSheet();

  sheet.setCell({ col: 2, row: 1 }, "Priority");
  sheet.setCell({ col: 2, row: 2 }, "9");
  sheet.setCell({ col: 2, row: 3 }, "1");
  sheet.setCell({ col: 2, row: 4 }, "5");

  const nextRowOrder = sortRowsByColumn({
    direction: "asc",
    preserveFirstRow: true,
    rowOrder: sheet.getRowOrder(),
    rows: [1, 2, 3, 4],
    sheet,
    sortColumn: 2,
  });

  assert.deepEqual(nextRowOrder.slice(0, 4), [1, 3, 4, 2]);
});

test("findCellMatches scans only populated sparse cells", () => {
  const sheet = new SparseSheet();

  sheet.setCell({ col: 1, row: 1 }, "Northwind");
  sheet.setCell({ col: 2, row: 10 }, "southwind");
  sheet.setCell({ col: 3, row: 2 }, "Inventory");

  assert.deepEqual(
    findCellMatches({
      query: "wind",
      sheet,
    }).map((match) => match.key),
    ["1:1", "10:2"]
  );

  assert.deepEqual(
    findCellMatches({
      caseSensitive: true,
      query: "south",
      sheet,
    }).map((match) => match.key),
    ["10:2"]
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  getRenderedCellValue,
  getResolvedHorizontalAlign,
} from "@/features/spreadsheet/cell-formatting";

test("renders numeric cells without additional display formatting", () => {
  assert.equal(
    getRenderedCellValue({
      cell: {
        kind: "number",
        raw: "1234.5",
      },
      computedValue: undefined,
      formulaError: undefined,
    }),
    "1234.5"
  );

  assert.equal(
    getRenderedCellValue({
      cell: {
        kind: "formula",
        raw: "=A1/4",
      },
      computedValue: 0.25,
      formulaError: undefined,
    }),
    "0.25"
  );
});

test("falls back cleanly for formula errors and non-numeric values", () => {
  assert.equal(
    getRenderedCellValue({
      cell: {
        kind: "formula",
        raw: "=A1+B1",
      },
      computedValue: 4,
      formulaError: "Division by zero",
    }),
    "#ERROR"
  );

  assert.equal(
    getRenderedCellValue({
      cell: {
        kind: "text",
        raw: "Northwind",
      },
      computedValue: undefined,
      formulaError: undefined,
    }),
    "Northwind"
  );
});

test("resolves alignment like a spreadsheet when no explicit format exists", () => {
  assert.equal(
    getResolvedHorizontalAlign({
      cell: {
        kind: "number",
        raw: "42",
      },
      computedValue: undefined,
      format: null,
      formulaError: undefined,
    }),
    "right"
  );

  assert.equal(
    getResolvedHorizontalAlign({
      cell: {
        kind: "text",
        raw: "Inventory",
      },
      computedValue: undefined,
      format: null,
      formulaError: undefined,
    }),
    "left"
  );

  assert.equal(
    getResolvedHorizontalAlign({
      cell: {
        kind: "number",
        raw: "42",
      },
      computedValue: undefined,
      format: {
        align: "center",
      },
      formulaError: undefined,
    }),
    "center"
  );
});

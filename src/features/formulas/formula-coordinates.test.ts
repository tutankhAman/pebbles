import assert from "node:assert/strict";
import test from "node:test";
import {
  formulaAddressToKey,
  keyToFormulaAddress,
  normalizeComputedValue,
} from "@/features/formulas/formula-coordinates";

test("maps canonical cell keys to zero-based formula addresses", () => {
  assert.deepEqual(keyToFormulaAddress("12:7"), {
    col: 6,
    row: 11,
    sheet: 0,
  });
});

test("maps formula addresses back to canonical keys", () => {
  assert.equal(
    formulaAddressToKey({
      col: 3,
      row: 4,
      sheet: 0,
    }),
    "5:4"
  );
});

test("normalizes computed values into render-safe primitives", () => {
  assert.equal(normalizeComputedValue(42), 42);
  assert.equal(normalizeComputedValue(true), true);
  assert.equal(normalizeComputedValue(null), null);
  assert.equal(normalizeComputedValue({ value: "#ERR!" }), "[object Object]");
});

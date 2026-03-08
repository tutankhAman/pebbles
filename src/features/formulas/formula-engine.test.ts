import assert from "node:assert/strict";
import test from "node:test";
import {
  FormulaEngine,
  formulaAddressFromKey,
  formulaKeyFromAddress,
} from "@/features/formulas/formula-engine";

test("converts canonical row:col keys to HyperFormula addresses", () => {
  assert.deepEqual(formulaAddressFromKey("4:7"), {
    col: 6,
    row: 3,
    sheet: 0,
  });

  assert.equal(
    formulaKeyFromAddress({
      col: 6,
      row: 3,
    }),
    "4:7"
  );
});

test("evaluates arithmetic formulas through HyperFormula", () => {
  const engine = new FormulaEngine();
  const result = engine.bootstrap([
    { key: "1:1", raw: "1" },
    { key: "1:2", raw: "2" },
    { key: "1:3", raw: "=A1+B1" },
  ]);

  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.values, [
    { key: "1:1", value: 1 },
    { key: "1:2", value: 2 },
    { key: "1:3", value: 3 },
  ]);
});

test("recomputes direct references and SUM ranges", () => {
  const engine = new FormulaEngine();

  engine.bootstrap([
    { key: "1:1", raw: "2" },
    { key: "2:1", raw: "3" },
    { key: "3:1", raw: "=SUM(A1:A2)" },
    { key: "1:2", raw: "=A1+A2" },
  ]);

  const recomputed = engine.recomputeVisible(["3:1", "1:2"]);

  assert.deepEqual(recomputed.values, [
    { key: "3:1", value: 5 },
    { key: "1:2", value: 5 },
  ]);
});

test("surfaces formula errors for invalid references", () => {
  const engine = new FormulaEngine();
  const result = engine.bootstrap([{ key: "1:1", raw: "=ZZ1" }]);

  assert.equal(result.values.length, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]?.key, "1:1");
});

test("updates dependent formulas after an upsert", () => {
  const engine = new FormulaEngine();

  engine.bootstrap([
    { key: "1:1", raw: "4" },
    { key: "1:2", raw: "=A1*2" },
  ]);

  const updated = engine.upsertCell({ key: "1:1", raw: "8" });

  assert.equal(updated.errors.length, 0);
  assert.deepEqual(updated.values, [
    { key: "1:1", value: 8 },
    { key: "1:2", value: 16 },
  ]);
});

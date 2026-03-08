import { parseCellKey } from "@/features/spreadsheet/addressing";
import type { ComputedValue } from "@/types/spreadsheet";

interface FormulaAddress {
  col: number;
  row: number;
  sheet: number;
}

const DEFAULT_SHEET_ID = 0;

export function keyToFormulaAddress(
  key: string,
  sheet = DEFAULT_SHEET_ID
): FormulaAddress {
  const address = parseCellKey(key);

  return {
    col: address.col - 1,
    row: address.row - 1,
    sheet,
  };
}

export function formulaAddressToKey(address: FormulaAddress) {
  return `${address.row + 1}:${address.col + 1}`;
}

export function normalizeComputedValue(value: unknown): ComputedValue {
  if (
    value == null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value ?? null;
  }

  return String(value);
}

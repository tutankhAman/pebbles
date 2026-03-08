import type {
  CellFormatRecord,
  CellHorizontalAlignment,
  CellRecord,
  ComputedValue,
} from "@/types/spreadsheet";

function getNumericDisplayValue(args: {
  cell: CellRecord | null;
  computedValue: ComputedValue | undefined;
  formulaError: string | undefined;
}) {
  if (args.formulaError) {
    return null;
  }

  if (args.cell?.kind === "formula") {
    return typeof args.computedValue === "number" ? args.computedValue : null;
  }

  if (args.cell?.kind !== "number") {
    return null;
  }

  const numericValue = Number(args.cell.raw);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function getRenderedCellValue(args: {
  cell: CellRecord | null;
  computedValue: ComputedValue | undefined;
  formulaError: string | undefined;
}) {
  if (!args.cell) {
    return "";
  }

  if (args.formulaError) {
    return "#ERROR";
  }

  const numericValue = getNumericDisplayValue(args);

  if (numericValue != null) {
    return String(numericValue);
  }

  if (args.cell.kind === "formula") {
    return args.computedValue == null
      ? args.cell.raw
      : String(args.computedValue);
  }

  return args.cell.raw;
}

export function getResolvedHorizontalAlign(args: {
  cell: CellRecord | null;
  computedValue: ComputedValue | undefined;
  format: CellFormatRecord | null;
  formulaError: string | undefined;
}): CellHorizontalAlignment {
  if (args.format?.align) {
    return args.format.align;
  }

  return getNumericDisplayValue(args) == null ? "left" : "right";
}

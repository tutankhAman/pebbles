import { toA1Address } from "@/features/spreadsheet/addressing";
import type { CellFormatRecord, CellRecord } from "@/types/spreadsheet";

function escapeCsvValue(value: string, delimiter: string) {
  if (
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r") ||
    value.includes(delimiter)
  ) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export function createDelimitedExport(
  matrix: string[][],
  delimiter: "," | "\t"
) {
  return matrix
    .map((row) =>
      row.map((value) => escapeCsvValue(value, delimiter)).join(delimiter)
    )
    .join("\n");
}

export function createJsonExport(args: {
  cells: Map<string, CellRecord>;
  columnOrder: number[];
  columnWidths: Map<number, number>;
  formats: Map<string, CellFormatRecord>;
  rowHeights: Map<number, number>;
  rowOrder: number[];
}) {
  return JSON.stringify(
    {
      cells: Array.from(args.cells.entries()).map(([key, value]) => ({
        address: toA1Address({
          col: Number.parseInt(key.split(":")[1] ?? "0", 10),
          row: Number.parseInt(key.split(":")[0] ?? "0", 10),
        }),
        format: args.formats.get(key) ?? null,
        raw: value.raw,
      })),
      columnOrder: args.columnOrder,
      columnWidths: Object.fromEntries(args.columnWidths),
      rowHeights: Object.fromEntries(args.rowHeights),
      rowOrder: args.rowOrder,
    },
    null,
    2
  );
}

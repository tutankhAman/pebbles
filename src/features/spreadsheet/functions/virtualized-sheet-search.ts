import { parseCellKey } from "@/features/spreadsheet/addressing";
import type { SparseSheet } from "@/features/spreadsheet/sparse-sheet";
import type { CellRecord } from "@/types/spreadsheet";

export type SortDirection = "asc" | "desc";

export interface SearchMatch {
  key: string;
  raw: string;
}

function compareCellValues(
  left: string,
  right: string,
  direction: SortDirection
) {
  const leftValue = left.trim();
  const rightValue = right.trim();

  if (leftValue === "" && rightValue === "") {
    return 0;
  }

  if (leftValue === "") {
    return 1;
  }

  if (rightValue === "") {
    return -1;
  }

  const leftNumber = Number(leftValue);
  const rightNumber = Number(rightValue);
  const areNumbers =
    Number.isFinite(leftNumber) && Number.isFinite(rightNumber);

  if (areNumbers) {
    return direction === "asc"
      ? leftNumber - rightNumber
      : rightNumber - leftNumber;
  }

  const comparison = leftValue.localeCompare(rightValue, undefined, {
    numeric: true,
    sensitivity: "base",
  });

  return direction === "asc" ? comparison : comparison * -1;
}

export function sortRowsByColumn(args: {
  direction: SortDirection;
  preserveFirstRow?: boolean;
  rowOrder: number[];
  rows: number[];
  sheet: SparseSheet;
  sortColumn: number;
}) {
  const candidateRows =
    args.preserveFirstRow && args.rows.includes(1)
      ? args.rows.filter((row) => row !== 1)
      : args.rows;

  if (candidateRows.length < 2) {
    return args.rowOrder;
  }

  const originalIndexes = new Map(
    candidateRows.map((row, index) => [row, index] as const)
  );
  const sortedRows = [...candidateRows].sort((leftRow, rightRow) => {
    const comparison = compareCellValues(
      args.sheet.getCell({ col: args.sortColumn, row: leftRow })?.raw ?? "",
      args.sheet.getCell({ col: args.sortColumn, row: rightRow })?.raw ?? "",
      args.direction
    );

    if (comparison !== 0) {
      return comparison;
    }

    return (
      (originalIndexes.get(leftRow) ?? 0) - (originalIndexes.get(rightRow) ?? 0)
    );
  });
  const candidateRowSet = new Set(candidateRows);
  let sortedIndex = 0;

  return args.rowOrder.map((row) => {
    if (!candidateRowSet.has(row)) {
      return row;
    }

    const nextRow = sortedRows[sortedIndex];
    sortedIndex += 1;
    return nextRow;
  });
}

export function findCellMatches(args: {
  caseSensitive?: boolean;
  cells?: Map<string, CellRecord>;
  query: string;
  sheet?: SparseSheet;
}) {
  const normalizedQuery = args.caseSensitive
    ? args.query
    : args.query.toLowerCase();

  if (normalizedQuery.trim() === "") {
    return [] satisfies SearchMatch[];
  }

  const matches: SearchMatch[] = [];

  for (const [key, cell] of args.cells ?? args.sheet?.getCells() ?? new Map()) {
    const haystack = args.caseSensitive ? cell.raw : cell.raw.toLowerCase();

    if (haystack.includes(normalizedQuery)) {
      matches.push({
        key,
        raw: cell.raw,
      });
    }
  }

  return matches.sort((left, right) => {
    const leftAddress = parseCellKey(left.key);
    const rightAddress = parseCellKey(right.key);

    if (leftAddress.row !== rightAddress.row) {
      return leftAddress.row - rightAddress.row;
    }

    return leftAddress.col - rightAddress.col;
  });
}

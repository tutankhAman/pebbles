import type { CellAddress, SheetBounds } from "@/types/spreadsheet";

const LETTERS_IN_ALPHABET = 26;
const UPPERCASE_A_CHAR_CODE = 65;
const A1_ADDRESS_PATTERN = /^([A-Z]+)(\d+)$/u;
const COLUMN_LETTERS_PATTERN = /^[A-Z]+$/u;

export function createCellKey(address: CellAddress) {
  return `${address.row}:${address.col}`;
}

export function parseCellKey(cellKey: string): CellAddress {
  const [rowValue, colValue] = cellKey.split(":");
  const row = Number.parseInt(rowValue, 10);
  const col = Number.parseInt(colValue, 10);

  if (!(Number.isInteger(row) && Number.isInteger(col))) {
    throw new Error(`Invalid cell key: ${cellKey}`);
  }

  return {
    col,
    row,
  };
}

export function columnNumberToLetters(columnNumber: number) {
  if (columnNumber < 1) {
    throw new Error("Column number must be greater than 0.");
  }

  let currentValue = columnNumber;
  let letters = "";

  while (currentValue > 0) {
    const remainder = (currentValue - 1) % LETTERS_IN_ALPHABET;
    letters = String.fromCharCode(UPPERCASE_A_CHAR_CODE + remainder) + letters;
    currentValue = Math.floor((currentValue - 1) / LETTERS_IN_ALPHABET);
  }

  return letters;
}

export function columnLettersToNumber(columnLetters: string) {
  if (!COLUMN_LETTERS_PATTERN.test(columnLetters)) {
    throw new Error(`Invalid column letters: ${columnLetters}`);
  }

  let total = 0;

  for (const character of columnLetters) {
    total =
      total * LETTERS_IN_ALPHABET +
      (character.charCodeAt(0) - UPPERCASE_A_CHAR_CODE + 1);
  }

  return total;
}

export function toA1Address(address: CellAddress) {
  return `${columnNumberToLetters(address.col)}${address.row}`;
}

export function parseA1Address(a1Address: string): CellAddress {
  const match = a1Address.trim().toUpperCase().match(A1_ADDRESS_PATTERN);

  if (!match) {
    throw new Error(`Invalid A1 address: ${a1Address}`);
  }

  return {
    col: columnLettersToNumber(match[1]),
    row: Number.parseInt(match[2], 10),
  };
}

export function isAddressWithinBounds(
  address: CellAddress,
  bounds: SheetBounds
) {
  return (
    address.row >= 1 &&
    address.col >= 1 &&
    address.row <= bounds.rowCount &&
    address.col <= bounds.colCount
  );
}

export function assertAddressWithinBounds(
  address: CellAddress,
  bounds: SheetBounds
) {
  if (!isAddressWithinBounds(address, bounds)) {
    throw new Error(
      `Address ${toA1Address(address)} is outside bounds ${bounds.rowCount}x${bounds.colCount}.`
    );
  }
}

export function normalizeRange(
  start: CellAddress,
  end: CellAddress
): {
  end: CellAddress;
  start: CellAddress;
} {
  return {
    end: {
      col: Math.max(start.col, end.col),
      row: Math.max(start.row, end.row),
    },
    start: {
      col: Math.min(start.col, end.col),
      row: Math.min(start.row, end.row),
    },
  };
}

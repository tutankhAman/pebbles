import {
  assertAddressWithinBounds,
  createCellKey,
  parseCellKey,
} from "@/features/spreadsheet/addressing";
import {
  DEFAULT_CHUNK_SIZE,
  getChunkKeyForAddress,
} from "@/features/spreadsheet/chunks";
import type {
  CellAddress,
  CellContent,
  CellFormat,
  CellFormatRecord,
  CellRecord,
  ChunkSize,
  SheetBounds,
} from "@/types/spreadsheet";

export const DEFAULT_SHEET_BOUNDS: SheetBounds = {
  colCount: 100,
  rowCount: 10_000,
};

function inferCellKind(rawValue: string): CellContent["kind"] {
  if (rawValue.startsWith("=")) {
    return "formula";
  }

  return Number.isFinite(Number(rawValue)) && rawValue.trim() !== ""
    ? "number"
    : "text";
}

function toCellRecord(content: CellContent | string): CellRecord {
  if (typeof content === "string") {
    return {
      kind: inferCellKind(content),
      raw: content,
    };
  }

  return {
    kind: content.kind,
    raw: content.raw,
  };
}

function normalizeCellFormat(
  format: CellFormat | CellFormatRecord | null | undefined
) {
  if (!format) {
    return null;
  }

  const nextFormat: CellFormatRecord = {};

  if (format.backgroundColor) {
    nextFormat.backgroundColor = format.backgroundColor;
  }

  if (format.bold) {
    nextFormat.bold = true;
  }

  if (format.italic) {
    nextFormat.italic = true;
  }

  if (format.textColor) {
    nextFormat.textColor = format.textColor;
  }

  if ("updatedAt" in format && format.updatedAt) {
    nextFormat.updatedAt = format.updatedAt;
  }

  if ("updatedBy" in format && format.updatedBy) {
    nextFormat.updatedBy = format.updatedBy;
  }

  return Object.keys(nextFormat).length > 0 ? nextFormat : null;
}

function normalizeAxisOrder(order: number[], count: number) {
  const nextOrder: number[] = [];
  const seen = new Set<number>();

  for (const value of order) {
    if (value < 1 || value > count || seen.has(value)) {
      continue;
    }

    seen.add(value);
    nextOrder.push(value);
  }

  for (let index = 1; index <= count; index += 1) {
    if (!seen.has(index)) {
      nextOrder.push(index);
    }
  }

  return nextOrder;
}

export class SparseSheet {
  readonly bounds: SheetBounds;
  readonly chunkSize: ChunkSize;
  private readonly cells: Map<string, CellRecord>;
  private readonly columnWidths: Map<number, number>;
  private columnOrder: number[];
  private readonly formats: Map<string, CellFormatRecord>;
  private readonly rowHeights: Map<number, number>;
  private rowOrder: number[];

  constructor(
    bounds: SheetBounds = DEFAULT_SHEET_BOUNDS,
    chunkSize: ChunkSize = DEFAULT_CHUNK_SIZE
  ) {
    this.bounds = bounds;
    this.chunkSize = chunkSize;
    this.cells = new Map<string, CellRecord>();
    this.formats = new Map<string, CellFormatRecord>();
    this.columnWidths = new Map<number, number>();
    this.rowHeights = new Map<number, number>();
    this.columnOrder = Array.from(
      { length: bounds.colCount },
      (_, index) => index + 1
    );
    this.rowOrder = Array.from(
      { length: bounds.rowCount },
      (_, index) => index + 1
    );
  }

  get cellCount() {
    return this.cells.size;
  }

  get formattedCellCount() {
    return this.formats.size;
  }

  setCell(address: CellAddress, content: CellContent | string) {
    assertAddressWithinBounds(address, this.bounds);
    const cellKey = createCellKey(address);
    const nextCell = toCellRecord(content);

    if (nextCell.raw.trim() === "") {
      this.cells.delete(cellKey);
      return null;
    }

    this.cells.set(cellKey, nextCell);
    return nextCell;
  }

  setCellByKey(cellKey: string, content: CellContent | string) {
    return this.setCell(parseCellKey(cellKey), content);
  }

  clearCell(address: CellAddress) {
    assertAddressWithinBounds(address, this.bounds);
    const cellKey = createCellKey(address);
    return this.cells.delete(cellKey);
  }

  clearCellByKey(cellKey: string) {
    return this.clearCell(parseCellKey(cellKey));
  }

  getCell(address: CellAddress) {
    assertAddressWithinBounds(address, this.bounds);
    return this.cells.get(createCellKey(address)) ?? null;
  }

  getCellByKey(cellKey: string) {
    const address = parseCellKey(cellKey);
    return this.getCell(address);
  }

  setCellFormat(address: CellAddress, format: CellFormat | null) {
    assertAddressWithinBounds(address, this.bounds);
    const cellKey = createCellKey(address);
    const nextFormat = normalizeCellFormat(format);

    if (!nextFormat) {
      this.formats.delete(cellKey);
      return null;
    }

    this.formats.set(cellKey, nextFormat);
    return nextFormat;
  }

  setCellFormatByKey(
    cellKey: string,
    format: CellFormat | CellFormatRecord | null
  ) {
    return this.setCellFormat(parseCellKey(cellKey), format ?? null);
  }

  patchCellFormat(address: CellAddress, patch: CellFormat) {
    assertAddressWithinBounds(address, this.bounds);
    const current = this.getCellFormat(address);

    return this.setCellFormat(address, {
      ...current,
      ...patch,
    });
  }

  clearCellFormat(address: CellAddress) {
    assertAddressWithinBounds(address, this.bounds);
    return this.formats.delete(createCellKey(address));
  }

  getCellFormat(address: CellAddress) {
    assertAddressWithinBounds(address, this.bounds);
    return this.formats.get(createCellKey(address)) ?? null;
  }

  getCellFormatByKey(cellKey: string) {
    return this.formats.get(cellKey) ?? null;
  }

  readRange(start: CellAddress, end: CellAddress) {
    assertAddressWithinBounds(start, this.bounds);
    assertAddressWithinBounds(end, this.bounds);

    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    const rows: Array<Array<CellRecord | null>> = [];

    for (let row = minRow; row <= maxRow; row += 1) {
      const currentRow: Array<CellRecord | null> = [];

      for (let col = minCol; col <= maxCol; col += 1) {
        currentRow.push(this.cells.get(`${row}:${col}`) ?? null);
      }

      rows.push(currentRow);
    }

    return rows;
  }

  batchPaste(
    start: CellAddress,
    matrix: Array<Array<CellContent | string | null | undefined>>
  ) {
    assertAddressWithinBounds(start, this.bounds);

    const touchedKeys: string[] = [];

    for (const [rowOffset, rowValues] of matrix.entries()) {
      for (const [colOffset, value] of rowValues.entries()) {
        if (value == null) {
          continue;
        }

        const address = {
          col: start.col + colOffset,
          row: start.row + rowOffset,
        };

        assertAddressWithinBounds(address, this.bounds);
        this.setCell(address, value);
        touchedKeys.push(createCellKey(address));
      }
    }

    return touchedKeys;
  }

  batchFormat(addresses: CellAddress[], patch: CellFormat) {
    const touchedKeys: string[] = [];

    for (const address of addresses) {
      const changed = this.patchCellFormat(address, patch);

      if (changed) {
        touchedKeys.push(createCellKey(address));
      }
    }

    return touchedKeys;
  }

  setColumnWidth(column: number, width: number | null) {
    if (column < 1 || column > this.bounds.colCount) {
      throw new Error(`Column ${column} is outside sheet bounds.`);
    }

    if (width == null) {
      this.columnWidths.delete(column);
      return null;
    }

    this.columnWidths.set(column, width);
    return width;
  }

  getColumnWidth(column: number) {
    return this.columnWidths.get(column) ?? null;
  }

  setRowHeight(row: number, height: number | null) {
    if (row < 1 || row > this.bounds.rowCount) {
      throw new Error(`Row ${row} is outside sheet bounds.`);
    }

    if (height == null) {
      this.rowHeights.delete(row);
      return null;
    }

    this.rowHeights.set(row, height);
    return height;
  }

  getRowHeight(row: number) {
    return this.rowHeights.get(row) ?? null;
  }

  setColumnOrder(order: number[]) {
    this.columnOrder = normalizeAxisOrder(order, this.bounds.colCount);
    return this.columnOrder;
  }

  getColumnOrder() {
    return [...this.columnOrder];
  }

  setRowOrder(order: number[]) {
    this.rowOrder = normalizeAxisOrder(order, this.bounds.rowCount);
    return this.rowOrder;
  }

  getRowOrder() {
    return [...this.rowOrder];
  }

  getChunkEntries(chunkKey: string) {
    const entries = Array.from(this.cells.entries()).filter(([cellKey]) => {
      const address = parseCellKey(cellKey);
      return getChunkKeyForAddress(address, this.chunkSize) === chunkKey;
    });

    return new Map(entries);
  }

  getCells() {
    return new Map(this.cells);
  }

  getFormats() {
    return new Map(this.formats);
  }

  getColumnWidths() {
    return new Map(this.columnWidths);
  }

  getRowHeights() {
    return new Map(this.rowHeights);
  }

  snapshot() {
    return {
      cells: new Map(this.cells),
      columnOrder: [...this.columnOrder],
      columnWidths: new Map(this.columnWidths),
      formats: new Map(this.formats),
      rowHeights: new Map(this.rowHeights),
      rowOrder: [...this.rowOrder],
    };
  }
}

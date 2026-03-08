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

export class SparseSheet {
  readonly bounds: SheetBounds;
  readonly chunkSize: ChunkSize;
  private readonly cells: Map<string, CellRecord>;

  constructor(
    bounds: SheetBounds = DEFAULT_SHEET_BOUNDS,
    chunkSize: ChunkSize = DEFAULT_CHUNK_SIZE
  ) {
    this.bounds = bounds;
    this.chunkSize = chunkSize;
    this.cells = new Map<string, CellRecord>();
  }

  get cellCount() {
    return this.cells.size;
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

  getChunkEntries(chunkKey: string) {
    const entries = Array.from(this.cells.entries()).filter(([cellKey]) => {
      const address = parseCellKey(cellKey);
      return getChunkKeyForAddress(address, this.chunkSize) === chunkKey;
    });

    return new Map(entries);
  }

  snapshot() {
    return new Map(this.cells);
  }
}

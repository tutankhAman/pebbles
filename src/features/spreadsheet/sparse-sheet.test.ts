import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createCellKey,
  parseA1Address,
  parseCellKey,
  toA1Address,
} from "@/features/spreadsheet/addressing";
import {
  DEFAULT_CHUNK_SIZE,
  getChunkKeyForAddress,
  getChunkKeysForViewport,
} from "@/features/spreadsheet/chunks";
import {
  DEFAULT_SHEET_BOUNDS,
  SparseSheet,
} from "@/features/spreadsheet/sparse-sheet";

describe("spreadsheet addressing helpers", () => {
  test("converts A1 notation to row and column coordinates", () => {
    assert.deepEqual(parseA1Address("A1"), { col: 1, row: 1 });
    assert.deepEqual(parseA1Address("AA12"), { col: 27, row: 12 });
    assert.equal(toA1Address({ col: 52, row: 99 }), "AZ99");
  });

  test("creates and parses canonical row:col keys", () => {
    const key = createCellKey({ col: 7, row: 12 });
    assert.equal(key, "12:7");
    assert.deepEqual(parseCellKey(key), { col: 7, row: 12 });
  });
});

describe("SparseSheet", () => {
  test("stores only populated cells and clears empty values", () => {
    const sheet = new SparseSheet();

    sheet.setCell({ col: 1, row: 1 }, "hello");
    sheet.setCell({ col: 2, row: 1 }, "42");

    assert.equal(sheet.cellCount, 2);
    assert.deepEqual(sheet.getCell({ col: 1, row: 1 }), {
      kind: "text",
      raw: "hello",
    });
    assert.deepEqual(sheet.getCell({ col: 2, row: 1 }), {
      kind: "number",
      raw: "42",
    });

    sheet.setCell({ col: 2, row: 1 }, "   ");
    assert.equal(sheet.getCell({ col: 2, row: 1 }), null);
    assert.equal(sheet.cellCount, 1);
  });

  test("reads rectangular ranges without allocating a dense sheet", () => {
    const sheet = new SparseSheet();

    sheet.batchPaste({ col: 2, row: 3 }, [
      ["A", "B"],
      ["C", null],
    ]);

    assert.deepEqual(sheet.readRange({ col: 1, row: 2 }, { col: 3, row: 4 }), [
      [null, null, null],
      [null, { kind: "text", raw: "A" }, { kind: "text", raw: "B" }],
      [null, { kind: "text", raw: "C" }, null],
    ]);
  });

  test("supports the 1M logical cell target through bounds, not dense allocation", () => {
    const sheet = new SparseSheet(DEFAULT_SHEET_BOUNDS, DEFAULT_CHUNK_SIZE);
    const maxAddress = {
      col: DEFAULT_SHEET_BOUNDS.colCount,
      row: DEFAULT_SHEET_BOUNDS.rowCount,
    };

    sheet.setCell(maxAddress, "=SUM(A1:A10)");

    assert.deepEqual(sheet.getCell(maxAddress), {
      kind: "formula",
      raw: "=SUM(A1:A10)",
    });
    assert.equal(sheet.cellCount, 1);
  });

  test("stores only non-default formatting metadata", () => {
    const sheet = new SparseSheet();

    sheet.setCellFormat(
      { col: 2, row: 3 },
      {
        align: "center",
        backgroundColor: "#fff7d6",
        bold: false,
        fontFamily: "serif",
        fontSize: 18,
        italic: false,
        textColor: "#1f2937",
        underline: true,
      }
    );

    assert.deepEqual(sheet.getCellFormat({ col: 2, row: 3 }), {
      align: "center",
      backgroundColor: "#fff7d6",
      fontFamily: "serif",
      fontSize: 18,
      textColor: "#1f2937",
      underline: true,
    });

    sheet.patchCellFormat(
      { col: 2, row: 3 },
      {
        align: undefined,
        fontFamily: undefined,
        fontSize: undefined,
        underline: false,
      }
    );

    assert.deepEqual(sheet.getCellFormat({ col: 2, row: 3 }), {
      backgroundColor: "#fff7d6",
      textColor: "#1f2937",
    });
  });

  test("clears formatting only within a requested range", () => {
    const sheet = new SparseSheet();

    sheet.setCellFormat({ col: 1, row: 1 }, { bold: true });
    sheet.setCellFormat({ col: 2, row: 2 }, { italic: true });
    sheet.setCellFormat({ col: 4, row: 4 }, { underline: true });

    assert.deepEqual(
      sheet.clearRangeFormats({ col: 1, row: 1 }, { col: 2, row: 2 }),
      ["1:1", "2:2"]
    );
    assert.equal(sheet.getCellFormat({ col: 1, row: 1 }), null);
    assert.equal(sheet.getCellFormat({ col: 2, row: 2 }), null);
    assert.deepEqual(sheet.getCellFormat({ col: 4, row: 4 }), {
      underline: true,
    });
  });

  test("restores a prior sparse snapshot", () => {
    const sheet = new SparseSheet();

    sheet.setCell({ col: 1, row: 1 }, "Before");
    sheet.setCellFormat({ col: 1, row: 1 }, { bold: true });
    sheet.setColumnWidth(1, 180);
    sheet.setRowHeight(1, 52);

    const snapshot = sheet.snapshot();

    sheet.setCell({ col: 2, row: 2 }, "After");
    sheet.clearCellFormat({ col: 1, row: 1 });
    sheet.setColumnWidth(1, 220);
    sheet.setRowHeight(1, 64);
    sheet.setColumnOrder([2, 1, 3]);
    sheet.setRowOrder([2, 1, 3, 4]);

    sheet.restore(snapshot);

    assert.deepEqual(sheet.getCell({ col: 1, row: 1 }), {
      kind: "text",
      raw: "Before",
    });
    assert.equal(sheet.getCell({ col: 2, row: 2 }), null);
    assert.deepEqual(sheet.getCellFormat({ col: 1, row: 1 }), {
      bold: true,
    });
    assert.equal(sheet.getColumnWidth(1), 180);
    assert.equal(sheet.getRowHeight(1), 52);
    assert.equal(sheet.getColumnOrder()[0], 1);
    assert.equal(sheet.getRowOrder()[0], 1);
  });

  test("inserts rows by shifting only sparse row data", () => {
    const sheet = new SparseSheet({ colCount: 4, rowCount: 5 });

    sheet.setCell({ col: 1, row: 2 }, "keep");
    sheet.setCell({ col: 2, row: 3 }, "move");
    sheet.setCell({ col: 3, row: 5 }, "drop");
    sheet.setCellFormat({ col: 2, row: 3 }, { italic: true });
    sheet.setRowHeight(3, 48);

    sheet.insertRows(3);

    assert.deepEqual(sheet.getCell({ col: 1, row: 2 }), {
      kind: "text",
      raw: "keep",
    });
    assert.equal(sheet.getCell({ col: 2, row: 3 }), null);
    assert.deepEqual(sheet.getCell({ col: 2, row: 4 }), {
      kind: "text",
      raw: "move",
    });
    assert.equal(sheet.getCell({ col: 3, row: 5 }), null);
    assert.deepEqual(sheet.getCellFormat({ col: 2, row: 4 }), {
      italic: true,
    });
    assert.equal(sheet.getRowHeight(4), 48);
  });

  test("inserts columns by shifting only sparse column data", () => {
    const sheet = new SparseSheet({ colCount: 4, rowCount: 5 });

    sheet.setCell({ col: 2, row: 1 }, "keep");
    sheet.setCell({ col: 3, row: 2 }, "move");
    sheet.setCell({ col: 4, row: 3 }, "drop");
    sheet.setCellFormat({ col: 3, row: 2 }, { underline: true });
    sheet.setColumnWidth(3, 196);

    sheet.insertColumns(3);

    assert.deepEqual(sheet.getCell({ col: 2, row: 1 }), {
      kind: "text",
      raw: "keep",
    });
    assert.equal(sheet.getCell({ col: 3, row: 2 }), null);
    assert.deepEqual(sheet.getCell({ col: 4, row: 2 }), {
      kind: "text",
      raw: "move",
    });
    assert.equal(sheet.getCell({ col: 4, row: 3 }), null);
    assert.deepEqual(sheet.getCellFormat({ col: 4, row: 2 }), {
      underline: true,
    });
    assert.equal(sheet.getColumnWidth(4), 196);
  });

  test("computes chunk keys for addresses and viewport ranges", () => {
    assert.equal(
      getChunkKeyForAddress({ col: 100, row: 100 }, DEFAULT_CHUNK_SIZE),
      "chunk_0_0_100x100"
    );
    assert.equal(
      getChunkKeyForAddress({ col: 101, row: 101 }, DEFAULT_CHUNK_SIZE),
      "chunk_1_1_100x100"
    );

    assert.deepEqual(
      getChunkKeysForViewport(
        {
          colEnd: 110,
          colStart: 1,
          overscan: 5,
          rowEnd: 110,
          rowStart: 1,
          scrollX: 0,
          scrollY: 0,
        },
        {
          colCount: 200,
          rowCount: 200,
        },
        DEFAULT_CHUNK_SIZE
      ),
      [
        "chunk_0_0_100x100",
        "chunk_0_1_100x100",
        "chunk_1_0_100x100",
        "chunk_1_1_100x100",
      ]
    );
  });
});

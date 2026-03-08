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

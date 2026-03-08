import {
  type CellValue,
  DetailedCellError,
  type ExportedChange,
  HyperFormula,
  type SimpleCellAddress,
} from "hyperformula";
import { parseCellKey } from "@/features/spreadsheet/addressing";
import type {
  FormulaWorkerCellInput,
  FormulaWorkerComputedValue,
  FormulaWorkerError,
} from "@/types/formula-worker";

const FORMULA_ENGINE_LICENSE_KEY = "gpl-v3";
const FORMULA_SHEET_ID = 0;
const FORMULA_SHEET_NAME = "Sheet1";
const MAX_FORMULA_COLUMNS = 100;
const MAX_FORMULA_ROWS = 10_000;

interface FormulaEvaluationResult {
  errors: FormulaWorkerError[];
  values: FormulaWorkerComputedValue[];
}

function createEngineInstance() {
  const engine = HyperFormula.buildEmpty({
    licenseKey: FORMULA_ENGINE_LICENSE_KEY,
    maxColumns: MAX_FORMULA_COLUMNS,
    maxRows: MAX_FORMULA_ROWS,
  });

  engine.addSheet(FORMULA_SHEET_NAME);
  return engine;
}

export function formulaAddressFromKey(cellKey: string): SimpleCellAddress {
  const address = parseCellKey(cellKey);

  return {
    col: address.col - 1,
    row: address.row - 1,
    sheet: FORMULA_SHEET_ID,
  };
}

export function formulaKeyFromAddress(address: { col: number; row: number }) {
  return `${address.row + 1}:${address.col + 1}`;
}

function normalizeComputedValue(value: CellValue) {
  if (value instanceof DetailedCellError) {
    return null;
  }

  return value;
}

function normalizeFormulaError(value: DetailedCellError, key: string) {
  return {
    key,
    message: value.message || value.value,
  };
}

export class FormulaEngine {
  private cells = new Map<string, string>();
  private engine = createEngineInstance();

  bootstrap(cells: FormulaWorkerCellInput[]): FormulaEvaluationResult {
    this.cells = new Map();
    this.resetEngine();

    const filteredInputs = cells.filter(({ raw }) => raw.trim() !== "");

    for (const input of filteredInputs) {
      this.cells.set(input.key, input.raw);
    }

    const changes = this.engine.batch(() => {
      for (const input of filteredInputs) {
        this.engine.setCellContents(
          formulaAddressFromKey(input.key),
          input.raw
        );
      }
    });

    return this.collectChanges(changes);
  }

  deleteCell(cellKey: string): FormulaEvaluationResult {
    this.cells.delete(cellKey);
    const changes = this.engine.setCellContents(
      formulaAddressFromKey(cellKey),
      ""
    );

    return this.collectChanges(changes);
  }

  recomputeVisible(keys: string[]): FormulaEvaluationResult {
    return this.collectKeys(keys);
  }

  upsertBatch(cells: FormulaWorkerCellInput[]): FormulaEvaluationResult {
    const filteredInputs = cells.filter(({ raw }) => raw.trim() !== "");

    for (const input of cells) {
      if (input.raw.trim() === "") {
        this.cells.delete(input.key);
        continue;
      }

      this.cells.set(input.key, input.raw);
    }

    const changes = this.engine.batch(() => {
      for (const input of cells) {
        this.engine.setCellContents(
          formulaAddressFromKey(input.key),
          input.raw
        );
      }
    });

    if (filteredInputs.length === 0 && cells.length > 0) {
      return this.collectKeys(cells.map(({ key }) => key));
    }

    return this.collectChanges(changes);
  }

  upsertCell(cell: FormulaWorkerCellInput): FormulaEvaluationResult {
    if (cell.raw.trim() === "") {
      return this.deleteCell(cell.key);
    }

    this.cells.set(cell.key, cell.raw);
    const changes = this.engine.setCellContents(
      formulaAddressFromKey(cell.key),
      cell.raw
    );

    return this.collectChanges(changes);
  }

  private collectChanges(changes: ExportedChange[]): FormulaEvaluationResult {
    const changedKeys = new Set<string>();

    for (const change of changes) {
      if (!("address" in change)) {
        continue;
      }

      changedKeys.add(formulaKeyFromAddress(change.address));
    }

    return this.collectKeys([...changedKeys]);
  }

  private collectKeys(keys: string[]): FormulaEvaluationResult {
    const dedupedKeys = [...new Set(keys)];
    const errors: FormulaWorkerError[] = [];
    const values: FormulaWorkerComputedValue[] = [];

    for (const key of dedupedKeys) {
      const value = this.engine.getCellValue(formulaAddressFromKey(key));

      if (value instanceof DetailedCellError) {
        errors.push(normalizeFormulaError(value, key));
        continue;
      }

      values.push({
        key,
        value: normalizeComputedValue(value),
      });
    }

    return {
      errors,
      values,
    };
  }

  private resetEngine() {
    this.engine.destroy();
    this.engine = createEngineInstance();
  }
}

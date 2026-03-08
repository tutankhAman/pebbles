import type { ComputedValue, SheetBounds } from "@/types/spreadsheet";

export interface FormulaWorkerCellInput {
  key: string;
  raw: string;
}

export type FormulaWorkerRequest =
  | {
      bounds: SheetBounds;
      cells: FormulaWorkerCellInput[];
      type: "bootstrap";
    }
  | {
      key: string;
      raw: string;
      type: "cell-upsert";
    }
  | {
      key: string;
      type: "cell-delete";
    }
  | {
      cells: FormulaWorkerCellInput[];
      type: "batch-upsert";
    }
  | {
      keys: string[];
      type: "recompute-visible";
    };

export interface FormulaWorkerComputedValue {
  key: string;
  value: ComputedValue;
}

export interface FormulaWorkerError {
  key: string;
  message: string;
}

export type FormulaWorkerResponse =
  | {
      type: "ready";
    }
  | {
      type: "computed";
      values: FormulaWorkerComputedValue[];
    }
  | {
      errors: FormulaWorkerError[];
      type: "errors";
    };

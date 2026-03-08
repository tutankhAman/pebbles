export interface CellAddress {
  col: number;
  row: number;
}

export type CellKind = "formula" | "number" | "text";

export interface CellContent {
  kind: CellKind;
  raw: string;
}

export interface FormulaInput {
  expression: string;
  raw: string;
}

export interface CellRecord extends CellContent {
  updatedAt?: number;
  updatedBy?: string;
}

export type ComputedValue = boolean | number | string | null;

export interface SheetBounds {
  colCount: number;
  rowCount: number;
}

export interface ChunkAddress {
  col: number;
  row: number;
}

export interface ChunkSize {
  colCount: number;
  rowCount: number;
}

export type Selection =
  | {
      anchor: CellAddress;
      type: "cell";
    }
  | {
      end: CellAddress;
      start: CellAddress;
      type: "range";
    };

export interface Viewport {
  colEnd: number;
  colStart: number;
  overscan: number;
  rowEnd: number;
  rowStart: number;
  scrollX: number;
  scrollY: number;
  viewportHeight?: number;
  viewportWidth?: number;
}

export interface VisibleWindow {
  colEnd: number;
  colStart: number;
  rowEnd: number;
  rowStart: number;
}

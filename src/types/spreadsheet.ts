export interface CellAddress {
  col: number;
  row: number;
}

export type CellKind = "formula" | "number" | "text";

export interface CellRecord {
  kind: CellKind;
  raw: string;
  updatedAt?: number;
  updatedBy?: string;
}

export type ComputedValue = boolean | number | string | null;

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
}

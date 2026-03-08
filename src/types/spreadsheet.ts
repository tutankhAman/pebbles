export interface CellAddress {
  col: number;
  row: number;
}

export type CellKind = "formula" | "number" | "text";
export const CELL_FONT_FAMILIES = [
  "display",
  "mono",
  "open-sans",
  "roboto",
  "montserrat",
  "lato",
  "roboto-slab",
  "poppins",
  "source-sans-3",
  "raleway",
  "oswald",
  "roboto-condensed",
  "sans",
  "serif",
] as const;
export type CellFontFamily = (typeof CELL_FONT_FAMILIES)[number];
export const CELL_FONT_SIZES = [12, 14, 16, 18, 20] as const;
export type CellFontSize = (typeof CELL_FONT_SIZES)[number];
export const CELL_HORIZONTAL_ALIGNMENTS = ["left", "center", "right"] as const;
export type CellHorizontalAlignment =
  (typeof CELL_HORIZONTAL_ALIGNMENTS)[number];

export interface CellContent {
  kind: CellKind;
  raw: string;
}

export interface CellFormat {
  align?: CellHorizontalAlignment;
  backgroundColor?: string;
  bold?: boolean;
  fontFamily?: CellFontFamily;
  fontSize?: CellFontSize;
  italic?: boolean;
  textColor?: string;
  underline?: boolean;
}

export interface FormulaInput {
  expression: string;
  raw: string;
}

export interface CellRecord extends CellContent {
  updatedAt?: number;
  updatedBy?: string;
}

export interface CellFormatRecord extends CellFormat {
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

export interface SheetMetrics {
  colWidth: number;
  overscan: number;
  rowHeaderWidth: number;
  rowHeight: number;
}

export interface AxisLayout {
  count: number;
  defaultSize: number;
  logicalToVisual: number[];
  order: number[];
  sizes: number[];
  starts: number[];
  totalSize: number;
}

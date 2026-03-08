import type { SparseSheetSnapshot } from "@/features/spreadsheet/sparse-sheet";
import type {
  CellFormatRecord,
  CellRecord,
  Selection,
} from "@/types/spreadsheet";

export type EditorSurface = "cell" | "formula-bar";
export type HelpPanel = "about" | "formulas" | "shortcuts";
export type MenuKey = "edit" | "file" | "format" | "help" | "insert" | "view";
export type ReorderAxis = "col" | "row";

export type HeaderDragState =
  | {
      axis: ReorderAxis;
      sourceLogicalIndex: number;
      targetLogicalIndex: number;
      type: "reorder";
    }
  | {
      axis: ReorderAxis;
      logicalIndex: number;
      type: "resize";
    };

export interface HistoryState {
  selection: Selection;
  snapshot: SparseSheetSnapshot;
}

export interface KeyedChange<T> {
  key: string;
  value: T | null;
}

export interface NumericChange {
  index: number;
  value: number | null;
}

export interface SnapshotChanges {
  cells: KeyedChange<CellRecord>[];
  columnOrderChanged: boolean;
  columnWidths: NumericChange[];
  formats: KeyedChange<CellFormatRecord>[];
  rowHeights: NumericChange[];
  rowOrderChanged: boolean;
}

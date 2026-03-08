import { CELL_FONT_FAMILY_LABELS } from "@/features/spreadsheet/cell-fonts";
import { SparseSheet } from "@/features/spreadsheet/sparse-sheet";
import type { HelpPanel } from "@/features/spreadsheet/types/virtualized-sheet";
import type { CellFontFamily, CellRecord } from "@/types/spreadsheet";
import type { WriteState } from "@/types/ui";

export function createSeededSheet() {
  return new SparseSheet();
}

export function getCellDisplayValue(cell: CellRecord | null) {
  return cell?.raw ?? "";
}

export function getCellKind(raw: string): CellRecord["kind"] {
  if (raw.startsWith("=")) {
    return "formula";
  }

  if (raw.trim() !== "" && Number.isFinite(Number(raw))) {
    return "number";
  }

  return "text";
}

export function getSelectionMatrix(
  sheet: SparseSheet,
  columnOrder: number[],
  rowOrder: number[]
) {
  return rowOrder.map((row) =>
    columnOrder.map((col) => getCellDisplayValue(sheet.getCell({ col, row })))
  );
}

export function getFontFamilyLabel(fontFamily: CellFontFamily) {
  return CELL_FONT_FAMILY_LABELS[fontFamily];
}

export function getHelpPanelTitle(activeHelpPanel: HelpPanel) {
  switch (activeHelpPanel) {
    case "formulas":
      return "Formula examples";
    case "shortcuts":
      return "Keyboard shortcuts";
    default:
      return "About this sheet";
  }
}

export function formatWriteState(writeState: WriteState) {
  switch (writeState) {
    case "saving":
      return "Saving...";
    case "saved":
      return "Saved";
    case "reconnecting":
      return "Reconnecting...";
    case "offline":
      return "Offline";
    default:
      return "Idle";
  }
}

export function captureLayoutState(sheet: SparseSheet) {
  return {
    columnOrder: sheet.getColumnOrder(),
    columnWidths: sheet.getColumnWidths(),
    rowHeights: sheet.getRowHeights(),
    rowOrder: sheet.getRowOrder(),
  };
}

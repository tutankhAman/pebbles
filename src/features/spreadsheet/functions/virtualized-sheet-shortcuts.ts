import type { Dispatch, KeyboardEvent, SetStateAction } from "react";
import {
  createCellSelection,
  extendSelection,
  getNavigationDelta,
  isPrintableCellInput,
  moveCellAddressInLayout,
} from "@/features/spreadsheet/interaction";
import type { HelpPanel } from "@/features/spreadsheet/types/virtualized-sheet";
import type {
  AxisLayout,
  CellAddress,
  CellFormat,
  CellFormatRecord,
  Selection,
  SheetBounds,
} from "@/types/spreadsheet";

type KeyboardTargetElement = HTMLDivElement | HTMLTextAreaElement;

export interface ShortcutHandlerArgs {
  activeCellFormat: CellFormatRecord | null;
  applyFormattingPatch: (patch: CellFormat) => void;
  clearSelectionFormatting: () => void;
  cutSelectionContents: () => Promise<void>;
  event: KeyboardEvent<KeyboardTargetElement>;
  insertColumn: (placement: "left" | "right") => void;
  insertRow: (placement: "above" | "below") => void;
  openRenameDialog: () => void;
  openSearchPanel: () => void;
  redoSelectionChange: () => void;
  setActiveHelpPanel: Dispatch<SetStateAction<HelpPanel | null>>;
  setFreezeFirstColumn: Dispatch<SetStateAction<boolean>>;
  setFreezeTopRow: Dispatch<SetStateAction<boolean>>;
  setShowCrosshairHighlight: Dispatch<SetStateAction<boolean>>;
  setShowFormulaBar: Dispatch<SetStateAction<boolean>>;
  setShowGridlines: Dispatch<SetStateAction<boolean>>;
  undoSelectionChange: () => void;
}

export function handleMetaShortcuts(args: ShortcutHandlerArgs) {
  const isModifierPressed = args.event.metaKey || args.event.ctrlKey;
  const lowerKey = args.event.key.toLowerCase();

  if (args.event.key === "F2") {
    args.event.preventDefault();
    args.openRenameDialog();
    return true;
  }

  if (args.event.shiftKey && args.event.key === "?") {
    args.event.preventDefault();
    args.setActiveHelpPanel("shortcuts");
    return true;
  }

  if (isModifierPressed && lowerKey === "z") {
    args.event.preventDefault();

    if (args.event.shiftKey) {
      args.redoSelectionChange();
      return true;
    }

    args.undoSelectionChange();
    return true;
  }

  if (isModifierPressed && lowerKey === "x") {
    args.event.preventDefault();
    args.cutSelectionContents().catch(() => undefined);
    return true;
  }

  if (isModifierPressed && lowerKey === "f") {
    args.event.preventDefault();
    args.openSearchPanel();
    return true;
  }

  if (isModifierPressed && lowerKey === "b") {
    args.event.preventDefault();
    args.applyFormattingPatch({
      bold: !args.activeCellFormat?.bold,
    });
    return true;
  }

  if (isModifierPressed && lowerKey === "i") {
    args.event.preventDefault();
    args.applyFormattingPatch({
      italic: !args.activeCellFormat?.italic,
    });
    return true;
  }

  if (isModifierPressed && lowerKey === "u") {
    args.event.preventDefault();
    args.applyFormattingPatch({
      underline: !args.activeCellFormat?.underline,
    });
    return true;
  }

  if (isModifierPressed && args.event.key === "/") {
    args.event.preventDefault();
    args.setShowFormulaBar((current) => !current);
    return true;
  }

  return false;
}

export function handleViewShortcuts(args: ShortcutHandlerArgs) {
  const lowerKey = args.event.key.toLowerCase();

  if (args.event.altKey && args.event.shiftKey && lowerKey === "t") {
    args.event.preventDefault();
    args.setFreezeTopRow((current) => !current);
    return true;
  }

  if (args.event.altKey && args.event.shiftKey && args.event.key === "1") {
    args.event.preventDefault();
    args.setFreezeFirstColumn((current) => !current);
    return true;
  }

  if (args.event.altKey && lowerKey === "g") {
    args.event.preventDefault();
    args.setShowGridlines((current) => !current);
    return true;
  }

  if (args.event.altKey && lowerKey === "h") {
    args.event.preventDefault();
    args.setShowCrosshairHighlight((current) => !current);
    return true;
  }

  return false;
}

export function handleFormatAndInsertShortcuts(args: ShortcutHandlerArgs) {
  const lowerKey = args.event.key.toLowerCase();

  if (args.event.altKey && args.event.shiftKey && lowerKey === "l") {
    args.event.preventDefault();
    args.applyFormattingPatch({
      align: args.activeCellFormat?.align === "left" ? undefined : "left",
    });
    return true;
  }

  if (args.event.altKey && args.event.shiftKey && lowerKey === "e") {
    args.event.preventDefault();
    args.applyFormattingPatch({
      align: args.activeCellFormat?.align === "center" ? undefined : "center",
    });
    return true;
  }

  if (args.event.altKey && args.event.shiftKey && lowerKey === "r") {
    args.event.preventDefault();
    args.applyFormattingPatch({
      align: args.activeCellFormat?.align === "right" ? undefined : "right",
    });
    return true;
  }

  if (args.event.altKey && args.event.shiftKey && lowerKey === "x") {
    args.event.preventDefault();
    args.clearSelectionFormatting();
    return true;
  }

  return false;
}

export function handleInsertShortcuts(args: ShortcutHandlerArgs) {
  if (
    args.event.altKey &&
    args.event.shiftKey &&
    args.event.key === "ArrowUp"
  ) {
    args.event.preventDefault();
    args.insertRow("above");
    return true;
  }

  if (
    args.event.altKey &&
    args.event.shiftKey &&
    args.event.key === "ArrowDown"
  ) {
    args.event.preventDefault();
    args.insertRow("below");
    return true;
  }

  if (
    args.event.altKey &&
    args.event.shiftKey &&
    args.event.key === "ArrowLeft"
  ) {
    args.event.preventDefault();
    args.insertColumn("left");
    return true;
  }

  if (
    args.event.altKey &&
    args.event.shiftKey &&
    args.event.key === "ArrowRight"
  ) {
    args.event.preventDefault();
    args.insertColumn("right");
    return true;
  }

  return false;
}

export interface NavigationHandlerArgs {
  activeCell: CellAddress;
  applySelection: (selection: Selection) => void;
  bounds: SheetBounds;
  clearSelectionContents: () => void;
  columnLayout: AxisLayout;
  event: KeyboardEvent<KeyboardTargetElement>;
  rowLayout: AxisLayout;
  selection: Selection;
  startTypingEdit: (address: CellAddress, initialValue: string) => void;
}

export function handleNavigationShortcuts(args: NavigationHandlerArgs) {
  if (
    args.event.key === "ArrowDown" ||
    args.event.key === "ArrowLeft" ||
    args.event.key === "ArrowRight" ||
    args.event.key === "ArrowUp" ||
    args.event.key === "Enter" ||
    args.event.key === "Tab"
  ) {
    args.event.preventDefault();
    const delta = getNavigationDelta(args.event.key, args.event.shiftKey);
    const nextAddress = moveCellAddressInLayout(
      args.activeCell,
      delta,
      args.bounds,
      args.columnLayout,
      args.rowLayout
    );

    args.applySelection(
      args.event.shiftKey
        ? extendSelection(args.selection, nextAddress)
        : createCellSelection(nextAddress)
    );
    return true;
  }

  if (args.event.key === "Backspace" || args.event.key === "Delete") {
    args.event.preventDefault();
    args.clearSelectionContents();
    return true;
  }

  if (args.event.key === "Escape") {
    args.event.preventDefault();
    args.applySelection(createCellSelection(args.activeCell));
    return true;
  }

  if (isPrintableCellInput(args.event)) {
    args.event.preventDefault();
    args.startTypingEdit(args.activeCell, args.event.key);
    return true;
  }

  return false;
}

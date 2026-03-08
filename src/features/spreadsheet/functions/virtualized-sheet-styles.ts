import type { CSSProperties } from "react";
import { CELL_FONT_FAMILY_STYLES } from "@/features/spreadsheet/cell-fonts";
import { getResolvedHorizontalAlign } from "@/features/spreadsheet/cell-formatting";
import type {
  CellFormatRecord,
  CellRecord,
  ComputedValue,
} from "@/types/spreadsheet";

function getCellBackgroundColor(args: {
  format: CellFormatRecord | null;
  isActive: boolean;
  isSelected: boolean;
}) {
  if (args.isActive) {
    return args.format?.backgroundColor ?? "rgba(37, 99, 235, 0.08)";
  }

  if (args.isSelected) {
    return args.format?.backgroundColor ?? "rgba(37, 99, 235, 0.04)";
  }

  return args.format?.backgroundColor ?? "#ffffff";
}

export function getHeaderBackgroundColor(
  isActive: boolean,
  isSelected: boolean
) {
  if (isActive) {
    return "#c8d7e8";
  }

  if (isSelected) {
    return "#d8e5f4";
  }

  return "#f8f9fa";
}

export function getToolbarButtonClassName(
  isActive: boolean,
  isDisabled = false
) {
  if (isDisabled) {
    return "flex h-7 min-w-7 items-center justify-center px-[0.375rem] text-[0.8125rem] text-[#9aa0a6] opacity-60";
  }

  return `flex h-7 min-w-7 items-center justify-center px-[0.375rem] text-[0.8125rem] transition-colors ${
    isActive
      ? "bg-[#e8f0fe] text-[#1a73e8]"
      : "bg-transparent text-[#444746] hover:bg-[#f1f3f4]"
  }`;
}

export function getCellContentStyle(args: {
  cell: CellRecord | null;
  computedValue: ComputedValue | undefined;
  format: CellFormatRecord | null;
  formulaError: string | undefined;
  isActive: boolean;
  isSelected: boolean;
}): CSSProperties {
  return {
    backgroundColor: getCellBackgroundColor({
      format: args.format,
      isActive: args.isActive,
      isSelected: args.isSelected,
    }),
    color: args.formulaError
      ? "#b42318"
      : (args.format?.textColor ?? "var(--foreground)"),
    fontFamily: args.format?.fontFamily
      ? CELL_FONT_FAMILY_STYLES[args.format.fontFamily]
      : undefined,
    fontSize: args.format?.fontSize ? `${args.format.fontSize}px` : undefined,
    fontStyle: args.format?.italic ? "italic" : "normal",
    fontWeight: args.format?.bold ? 700 : 400,
    lineHeight: args.format?.fontSize
      ? `${Math.max(20, args.format.fontSize + 6)}px`
      : undefined,
    textAlign: getResolvedHorizontalAlign({
      cell: args.cell,
      computedValue: args.computedValue,
      format: args.format,
      formulaError: args.formulaError,
    }),
    textDecorationLine: args.format?.underline ? "underline" : "none",
  };
}

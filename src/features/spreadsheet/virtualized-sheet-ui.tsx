import { memo, type SVGProps } from "react";
import { getRenderedCellValue } from "@/features/spreadsheet/cell-formatting";
import { getCellLayout } from "@/features/spreadsheet/viewport";
import type {
  AxisLayout,
  CellAddress,
  CellFormatRecord,
  CellRecord,
  ComputedValue,
} from "@/types/spreadsheet";
import { getCellContentStyle } from "./virtualized-sheet-helpers";

function ToolbarSvg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 16 16"
      width="14"
      {...props}
    />
  );
}

export function FontFamilyIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="M3 12.5 6.9 3.5h2.2l4 9" />
      <path d="M5 8.9h5.8" />
    </ToolbarSvg>
  );
}

export function FontSizeIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="M3 4.5h6" />
      <path d="M6 4.5v8" />
      <path d="M10 8.5h3" />
      <path d="M11.5 8.5v4" />
    </ToolbarSvg>
  );
}

export function TextColorIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="M3.5 12.5 7.8 3.5h.4l4.3 9" />
      <path d="M5.1 9.2h5.8" />
      <path d="M3 13.8h10" />
    </ToolbarSvg>
  );
}

export function FillColorIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="m4 6.2 3.8-3.7 4 4-3.8 3.8z" />
      <path d="M9.9 8.4 12.6 11" />
      <path d="M3 13.2h10" />
    </ToolbarSvg>
  );
}

export function AlignLeftIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="M3 4h8" />
      <path d="M3 7h5.5" />
      <path d="M3 10h8" />
      <path d="M3 13h4.5" />
    </ToolbarSvg>
  );
}

export function AlignCenterIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="M4 4h8" />
      <path d="M5.5 7h5" />
      <path d="M4 10h8" />
      <path d="M6 13h4" />
    </ToolbarSvg>
  );
}

export function AlignRightIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="M5 4h8" />
      <path d="M7.5 7H13" />
      <path d="M5 10h8" />
      <path d="M8.5 13H13" />
    </ToolbarSvg>
  );
}

export function SortAscendingIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="M4 3.5v9" />
      <path d="m2.5 5 1.5-1.5L5.5 5" />
      <path d="M8 5h5" />
      <path d="M8 8h4" />
      <path d="M8 11h3" />
    </ToolbarSvg>
  );
}

export function SortDescendingIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <path d="M4 3.5v9" />
      <path d="m2.5 11 1.5 1.5L5.5 11" />
      <path d="M8 5h3" />
      <path d="M8 8h4" />
      <path d="M8 11h5" />
    </ToolbarSvg>
  );
}

export function SearchIcon() {
  return (
    <ToolbarSvg aria-hidden="true">
      <circle cx="7" cy="7" r="3.5" />
      <path d="m9.8 9.8 2.7 2.7" />
    </ToolbarSvg>
  );
}

export function createShortcutLabel(label: string) {
  return (
    <span className="font-mono text-[#80868b] text-[0.6875rem] tracking-[0.02em]">
      {label}
    </span>
  );
}

export function MenuButton({
  isOpen,
  label,
  onClick,
}: {
  isOpen: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded px-2.5 py-1 text-[0.8125rem] capitalize leading-6 transition-colors ${
        isOpen
          ? "bg-[#d3e3fd] text-[#041e49]"
          : "text-[#444746] hover:bg-[#e8eaed] hover:text-[#202124]"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

export function MenuItem({
  checked,
  disabled,
  label,
  onClick,
  shortcut,
}: {
  checked?: boolean;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
  shortcut?: string;
}) {
  return (
    <button
      className="flex w-full items-center justify-between gap-6 rounded-sm px-2 py-1.5 text-left text-[#202124] text-[0.8125rem] leading-5 transition-colors hover:bg-[#e8eaed] disabled:cursor-not-allowed disabled:text-[#80868b]"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="flex items-center gap-2.5">
        <span className="flex w-4 items-center justify-center text-center text-[#1a73e8] text-[0.75rem]">
          {checked ? (
            <svg
              fill="none"
              height="14"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
              width="14"
            >
              <title>Selected</title>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            ""
          )}
        </span>
        <span>{label}</span>
      </span>
      {shortcut ? createShortcutLabel(shortcut) : null}
    </button>
  );
}

export const VirtualCell = memo(function VirtualCell({
  address,
  columnLayout,
  computedValue,
  displayLeft,
  displayTop,
  format,
  formulaError,
  isActive,
  isFrozen,
  isGridlinesVisible,
  isSelected,
  record,
  rowLayout,
}: {
  address: CellAddress;
  columnLayout: AxisLayout;
  computedValue: ComputedValue | undefined;
  displayLeft?: number;
  displayTop?: number;
  format: CellFormatRecord | null;
  formulaError: string | undefined;
  isActive: boolean;
  isFrozen?: boolean;
  isGridlinesVisible?: boolean;
  isSelected: boolean;
  record: CellRecord | null;
  rowLayout: AxisLayout;
}) {
  const layout = getCellLayout(address, columnLayout, rowLayout);
  const displayValue = getRenderedCellValue({
    cell: record,
    computedValue,
    formulaError,
  });
  return (
    <div
      className={`absolute flex items-center overflow-hidden px-1.5 py-0 text-[0.72rem] leading-[1.05rem] ${
        isGridlinesVisible === false ? "" : "border-[#e0e3e7] border-r border-b"
      }`}
      style={{
        height: layout.height,
        left: displayLeft ?? layout.left,
        top: displayTop ?? layout.top,
        width: layout.width,
        zIndex: isFrozen ? 12 : undefined,
        ...getCellContentStyle({
          cell: record,
          computedValue,
          format,
          formulaError,
          isActive,
          isSelected,
        }),
      }}
      title={formulaError}
    >
      <div className="w-full truncate">{displayValue}</div>
    </div>
  );
});

import { memo } from "react";
import { getRenderedCellValue } from "@/features/spreadsheet/cell-formatting";
import { getCellContentStyle } from "@/features/spreadsheet/functions/virtualized-sheet-styles";
import { getCellLayout } from "@/features/spreadsheet/viewport";
import type {
  AxisLayout,
  CellAddress,
  CellFormatRecord,
  CellRecord,
  ComputedValue,
} from "@/types/spreadsheet";

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

import type { PointerEvent as ReactPointerEvent } from "react";
import { getHeaderBackgroundColor } from "@/features/spreadsheet/functions/virtualized-sheet-styles";
import type { HeaderDragState } from "@/features/spreadsheet/types/virtualized-sheet";
import type { AxisLayout } from "@/types/spreadsheet";

export function RowHeaders({
  activeRow,
  headerDragState,
  isFullRowSelection,
  onResizePointerDown,
  onRowHeaderPointerDown,
  rowLayout,
  scrollY,
  selectedRowSet,
  showGridlines,
  visibleRows,
}: {
  activeRow: number;
  headerDragState: HeaderDragState | null;
  isFullRowSelection: boolean;
  onResizePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    row: number
  ) => void;
  onRowHeaderPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    row: number
  ) => void;
  rowLayout: AxisLayout;
  scrollY: number;
  selectedRowSet: Set<number>;
  showGridlines: boolean;
  visibleRows: number[];
}) {
  return (
    <div
      className={`relative overflow-hidden bg-[#f8f9fa] ${
        showGridlines ? "border-[#e0e0e0] border-r" : ""
      }`}
    >
      {visibleRows.map((row) => {
        const size = rowLayout.sizes[rowLayout.logicalToVisual[row]];
        const start = rowLayout.starts[rowLayout.logicalToVisual[row]];
        const top = start - scrollY;
        const isSelectedRow = selectedRowSet.has(row);
        const isActiveRow = row === activeRow;
        const isRowDraggable =
          isSelectedRow && isFullRowSelection && !headerDragState;

        return (
          <div
            className={`absolute left-0 ${
              showGridlines ? "border-[#e0e0e0] border-b" : ""
            }`}
            key={`row-${row}`}
            onPointerDown={(event) => {
              onRowHeaderPointerDown(event, row);
            }}
            style={{
              backgroundColor: getHeaderBackgroundColor(
                isActiveRow,
                isSelectedRow
              ),
              color: isSelectedRow ? "#202124" : "#5f6368",
              cursor: isRowDraggable ? "grab" : "default",
              height: size,
              top,
              width: "100%",
            }}
          >
            <div className="flex h-full select-none items-center justify-center px-1 text-[0.6875rem] leading-none">
              <span>{row}</span>
            </div>
            <div
              className="absolute right-0 bottom-0 h-2 w-full cursor-row-resize"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizePointerDown(event, row);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

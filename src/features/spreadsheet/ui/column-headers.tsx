import type { PointerEvent as ReactPointerEvent } from "react";
import { getHeaderBackgroundColor } from "@/features/spreadsheet/functions/virtualized-sheet-styles";
import type { HeaderDragState } from "@/features/spreadsheet/types/virtualized-sheet";
import { getColumnHeaderLabel } from "@/features/spreadsheet/viewport";
import type { AxisLayout } from "@/types/spreadsheet";

export function ColumnHeaders({
  activeColumn,
  headerDragState,
  isFullColumnSelection,
  onColumnHeaderPointerDown,
  onResizePointerDown,
  scrollX,
  selectedColumnSet,
  showGridlines,
  visibleColumns,
  columnLayout,
}: {
  activeColumn: number;
  columnLayout: AxisLayout;
  headerDragState: HeaderDragState | null;
  isFullColumnSelection: boolean;
  onColumnHeaderPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    column: number
  ) => void;
  onResizePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    column: number
  ) => void;
  scrollX: number;
  selectedColumnSet: Set<number>;
  showGridlines: boolean;
  visibleColumns: number[];
}) {
  return (
    <div
      className={`relative overflow-hidden bg-[#f8f9fa] ${
        showGridlines ? "border-[#e0e0e0] border-b" : ""
      }`}
    >
      {visibleColumns.map((column) => {
        const layout = columnLayout.sizes[columnLayout.logicalToVisual[column]];
        const start = columnLayout.starts[columnLayout.logicalToVisual[column]];
        const left = start - scrollX;
        const isSelectedColumn = selectedColumnSet.has(column);
        const isActiveColumn = column === activeColumn;
        const isColumnDraggable =
          isSelectedColumn && isFullColumnSelection && !headerDragState;

        return (
          <div
            className={`absolute top-0 h-full ${
              showGridlines ? "border-[#e0e0e0] border-r" : ""
            }`}
            key={`column-${column}`}
            onPointerDown={(event) => {
              onColumnHeaderPointerDown(event, column);
            }}
            style={{
              backgroundColor: getHeaderBackgroundColor(
                isActiveColumn,
                isSelectedColumn
              ),
              color: isSelectedColumn ? "#202124" : "#5f6368",
              cursor: isColumnDraggable ? "grab" : "default",
              left,
              width: layout,
            }}
          >
            <div className="flex h-full select-none items-center justify-center px-1 text-[0.6875rem] leading-none">
              <span>{getColumnHeaderLabel(column)}</span>
            </div>
            <div
              className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizePointerDown(event, column);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

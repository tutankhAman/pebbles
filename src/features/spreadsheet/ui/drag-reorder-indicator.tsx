import { getAxisLayoutByLogicalIndex } from "@/features/spreadsheet/sheet-layout";
import type { HeaderDragState } from "@/features/spreadsheet/types/virtualized-sheet";
import type { AxisLayout } from "@/types/spreadsheet";

export function DragReorderIndicator({
  columnLayout,
  headerDragState,
  rowLayout,
}: {
  columnLayout: AxisLayout;
  headerDragState: HeaderDragState | null;
  rowLayout: AxisLayout;
}) {
  if (headerDragState?.type !== "reorder") {
    return null;
  }

  if (headerDragState.axis === "col") {
    return (
      <div
        className="pointer-events-none absolute top-0 bottom-0 z-20 w-[3px] bg-[#2563eb]"
        style={{
          left:
            getAxisLayoutByLogicalIndex(
              columnLayout,
              headerDragState.targetLogicalIndex
            ).start - 1,
        }}
      />
    );
  }

  return (
    <div
      className="pointer-events-none absolute right-0 left-0 z-20 h-[3px] bg-[#2563eb]"
      style={{
        top:
          getAxisLayoutByLogicalIndex(
            rowLayout,
            headerDragState.targetLogicalIndex
          ).start - 1,
      }}
    />
  );
}

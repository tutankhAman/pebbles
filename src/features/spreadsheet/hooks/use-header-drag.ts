import { type RefObject, useEffect, useEffectEvent, useState } from "react";
import { commitHeaderDrag } from "@/features/spreadsheet/functions/virtualized-sheet-sync";
import {
  clampColumnWidth,
  clampRowHeight,
  getAxisLayoutByLogicalIndex,
} from "@/features/spreadsheet/sheet-layout";
import type { SparseSheet } from "@/features/spreadsheet/sparse-sheet";
import type { HeaderDragState } from "@/features/spreadsheet/types/virtualized-sheet";
import { getCellAddressFromPoint } from "@/features/spreadsheet/viewport";
import type { AxisLayout, SheetBounds } from "@/types/spreadsheet";

export function useHeaderDrag(args: {
  bounds: SheetBounds;
  columnLayout: AxisLayout;
  markLayoutDirty: () => void;
  rowLayout: AxisLayout;
  scheduleWriteConfirmation: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  setColumnOrder: (order: number[]) => void;
  setColumnWidth: (column: number, width: number | null) => void;
  setRowHeight: (row: number, height: number | null) => void;
  setRowOrder: (order: number[]) => void;
  sheet: SparseSheet;
  syncDocumentTimestamp: () => void;
}) {
  const [headerDragState, setHeaderDragState] =
    useState<HeaderDragState | null>(null);

  const applyColumnWidth = (column: number, width: number, sync = false) => {
    const nextWidth = clampColumnWidth(width);
    args.sheet.setColumnWidth(column, nextWidth);
    args.markLayoutDirty();

    if (sync) {
      args.setColumnWidth(column, nextWidth);
      args.scheduleWriteConfirmation();
      args.syncDocumentTimestamp();
    }
  };

  const applyRowHeight = (row: number, height: number, sync = false) => {
    const nextHeight = clampRowHeight(height);
    args.sheet.setRowHeight(row, nextHeight);
    args.markLayoutDirty();

    if (sync) {
      args.setRowHeight(row, nextHeight);
      args.scheduleWriteConfirmation();
      args.syncDocumentTimestamp();
    }
  };

  const handleHeaderPointerMove = useEffectEvent(
    (event: globalThis.PointerEvent) => {
      if (!headerDragState) {
        return;
      }

      const node = args.scrollRef.current;

      if (!node) {
        return;
      }

      const rect = node.getBoundingClientRect();
      const pointerX = event.clientX - rect.left + node.scrollLeft;
      const pointerY = event.clientY - rect.top + node.scrollTop;

      if (headerDragState.type === "resize") {
        if (headerDragState.axis === "col") {
          const layout = getAxisLayoutByLogicalIndex(
            args.columnLayout,
            headerDragState.logicalIndex
          );

          applyColumnWidth(
            headerDragState.logicalIndex,
            pointerX - layout.start
          );
          return;
        }

        const layout = getAxisLayoutByLogicalIndex(
          args.rowLayout,
          headerDragState.logicalIndex
        );

        applyRowHeight(headerDragState.logicalIndex, pointerY - layout.start);
        return;
      }

      if (headerDragState.axis === "col") {
        const nextTarget = getCellAddressFromPoint(
          { x: pointerX, y: 0 },
          args.bounds,
          args.columnLayout,
          args.rowLayout
        ).col;

        setHeaderDragState((current) =>
          current?.type === "reorder" && current.axis === "col"
            ? {
                ...current,
                targetLogicalIndex: nextTarget,
              }
            : current
        );
        return;
      }

      const nextTarget = getCellAddressFromPoint(
        { x: 0, y: pointerY },
        args.bounds,
        args.columnLayout,
        args.rowLayout
      ).row;

      setHeaderDragState((current) =>
        current?.type === "reorder" && current.axis === "row"
          ? {
              ...current,
              targetLogicalIndex: nextTarget,
            }
          : current
      );
    }
  );

  const handleHeaderPointerUp = useEffectEvent(() => {
    if (!headerDragState) {
      return;
    }

    commitHeaderDrag({
      applyColumnOrder: (order: number[], sync?: boolean) => {
        args.sheet.setColumnOrder(order);
        args.markLayoutDirty();
        if (sync) {
          args.setColumnOrder(order);
          args.scheduleWriteConfirmation();
          args.syncDocumentTimestamp();
        }
      },
      applyRowOrder: (order: number[], sync?: boolean) => {
        args.sheet.setRowOrder(order);
        args.markLayoutDirty();
        if (sync) {
          args.setRowOrder(order);
          args.scheduleWriteConfirmation();
          args.syncDocumentTimestamp();
        }
      },
      headerDragState,
      scheduleWriteConfirmation: args.scheduleWriteConfirmation,
      setColumnWidth: args.setColumnWidth,
      setRowHeight: args.setRowHeight,
      sheet: args.sheet,
      syncDocumentTimestamp: args.syncDocumentTimestamp,
    });

    setHeaderDragState(null);
  });

  useEffect(() => {
    if (!headerDragState) {
      return;
    }

    window.addEventListener("pointermove", handleHeaderPointerMove);
    window.addEventListener("pointerup", handleHeaderPointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handleHeaderPointerMove);
      window.removeEventListener("pointerup", handleHeaderPointerUp);
    };
  }, [headerDragState]);

  return {
    applyColumnWidth,
    applyRowHeight,
    headerDragState,
    setHeaderDragState,
  };
}

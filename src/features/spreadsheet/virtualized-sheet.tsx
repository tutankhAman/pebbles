"use client";

import {
  type PointerEvent,
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";
import { getVisibleWindow } from "@/features/spreadsheet/chunks";
import { SparseSheet } from "@/features/spreadsheet/sparse-sheet";
import {
  DEFAULT_SHEET_METRICS,
  getCellAddressFromPoint,
  getCellLayout,
  getColumnHeaderLabel,
  getGridDimensions,
  getViewportFromScroll,
} from "@/features/spreadsheet/viewport";
import type { DocumentMeta } from "@/types/metadata";
import type {
  CellAddress,
  CellRecord,
  SheetBounds,
  Viewport,
  VisibleWindow,
} from "@/types/spreadsheet";

const DEFAULT_VIEWPORT_WIDTH = 960;
const DEFAULT_VIEWPORT_HEIGHT = 640;
const DEFAULT_SELECTION: CellAddress = {
  col: 1,
  row: 1,
};

function createSeededSheet(document: DocumentMeta) {
  const sheet = new SparseSheet();

  sheet.batchPaste({ col: 1, row: 1 }, [
    [document.title, "Owner", document.ownerName, "Status", "Phase 3"],
    [
      "Room",
      document.roomId.slice(0, 12),
      "Modified",
      new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(document.lastModifiedAt),
      "Scroll to verify virtualization",
    ],
    ["Rows", "10,000", "Columns", "100", "Logical cells", "1,000,000"],
  ]);

  sheet.setCell({ col: 1, row: 128 }, "Checkpoint row 128");
  sheet.setCell({ col: 4, row: 512 }, "Checkpoint row 512");
  sheet.setCell({ col: 6, row: 4096 }, "Sparse far field");
  sheet.setCell({ col: 26, row: 9999 }, "Edge probe");

  return sheet;
}

function getCellDisplayValue(cell: CellRecord | null) {
  return cell?.raw ?? "";
}

function buildSequence(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function useVirtualViewport(bounds: SheetBounds) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingScrollRef = useRef({
    scrollX: 0,
    scrollY: 0,
  });
  const [viewport, setViewport] = useState<Viewport>(() =>
    getViewportFromScroll(
      {
        scrollX: 0,
        scrollY: 0,
        viewportHeight: DEFAULT_VIEWPORT_HEIGHT,
        viewportWidth: DEFAULT_VIEWPORT_WIDTH,
      },
      bounds
    )
  );

  useEffect(() => {
    const node = scrollRef.current;

    if (!node) {
      return;
    }

    const updateViewport = (
      nextScrollX: number,
      nextScrollY: number,
      nextWidth: number,
      nextHeight: number
    ) => {
      startTransition(() => {
        setViewport(
          getViewportFromScroll(
            {
              scrollX: nextScrollX,
              scrollY: nextScrollY,
              viewportHeight: nextHeight,
              viewportWidth: nextWidth,
            },
            bounds
          )
        );
      });
    };

    updateViewport(0, 0, node.clientWidth, node.clientHeight);

    const resizeObserver = new ResizeObserver(() => {
      updateViewport(
        pendingScrollRef.current.scrollX,
        pendingScrollRef.current.scrollY,
        node.clientWidth,
        node.clientHeight
      );
    });

    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [bounds]);

  const handleScroll = () => {
    const node = scrollRef.current;

    if (!node) {
      return;
    }

    pendingScrollRef.current = {
      scrollX: node.scrollLeft,
      scrollY: node.scrollTop,
    };

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      startTransition(() => {
        setViewport(
          getViewportFromScroll(
            {
              scrollX: pendingScrollRef.current.scrollX,
              scrollY: pendingScrollRef.current.scrollY,
              viewportHeight: node.clientHeight,
              viewportWidth: node.clientWidth,
            },
            bounds
          )
        );
      });
    });
  };

  return {
    handleScroll,
    scrollRef,
    viewport,
  };
}

export function VirtualizedSheet({ document }: { document: DocumentMeta }) {
  const sheetRef = useRef<SparseSheet | null>(null);

  if (sheetRef.current === null) {
    sheetRef.current = createSeededSheet(document);
  }

  const sheet = sheetRef.current;
  const bounds = sheet.bounds;
  const { height: gridHeight, width: gridWidth } = getGridDimensions(bounds);
  const { handleScroll, scrollRef, viewport } = useVirtualViewport(bounds);
  const [activeCell, setActiveCell] = useState<CellAddress>(DEFAULT_SELECTION);
  const visibleWindow: VisibleWindow = getVisibleWindow(viewport, bounds);
  const visibleRows = buildSequence(
    visibleWindow.rowStart,
    visibleWindow.rowEnd
  );
  const visibleColumns = buildSequence(
    visibleWindow.colStart,
    visibleWindow.colEnd
  );
  const selectionRect = getCellLayout(activeCell);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const node = scrollRef.current;

    if (!node) {
      return;
    }

    const rect = node.getBoundingClientRect();
    const nextAddress = getCellAddressFromPoint(
      {
        x: event.clientX - rect.left + node.scrollLeft,
        y: event.clientY - rect.top + node.scrollTop,
      },
      bounds
    );

    setActiveCell(nextAddress);
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-white/82 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between border-[var(--border)] border-b bg-[rgba(247,249,250,0.92)] px-4 py-3 text-[0.72rem] text-[var(--muted)] uppercase tracking-[0.18em]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[rgba(42,118,130,0.08)] px-3 py-1 font-mono text-[var(--accent)]">
            Active cell {getColumnHeaderLabel(activeCell.col)}
            {activeCell.row}
          </span>
          <span className="font-mono">
            Visible rows {visibleWindow.rowStart}-{visibleWindow.rowEnd}
          </span>
          <span className="font-mono">
            Visible cols {getColumnHeaderLabel(visibleWindow.colStart)}-
            {getColumnHeaderLabel(visibleWindow.colEnd)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono">
          <span>{bounds.rowCount.toLocaleString()} rows</span>
          <span>{bounds.colCount.toLocaleString()} cols</span>
          <span>{sheet.cellCount.toLocaleString()} populated</span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[4.5rem_minmax(0,1fr)] grid-rows-[3rem_minmax(0,1fr)] bg-[linear-gradient(180deg,_rgba(251,252,252,0.95),_rgba(244,247,248,0.92))]">
        <div className="border-[var(--border)] border-r border-b bg-[rgba(236,241,244,0.92)] px-3 py-3 font-mono text-[0.68rem] text-[var(--muted)] uppercase tracking-[0.28em]">
          Grid
        </div>

        <div className="relative overflow-hidden border-[var(--border)] border-b bg-[rgba(236,241,244,0.92)]">
          {visibleColumns.map((column) => {
            const left =
              (column - 1) * DEFAULT_SHEET_METRICS.colWidth - viewport.scrollX;
            const isActiveColumn = column === activeCell.col;

            return (
              <div
                className="absolute top-0 flex h-full items-center border-[var(--border)] border-r px-3 font-mono text-[0.76rem] uppercase tracking-[0.22em]"
                key={`column-${column}`}
                style={{
                  backgroundColor: isActiveColumn
                    ? "rgba(42,118,130,0.14)"
                    : "transparent",
                  color: isActiveColumn ? "var(--foreground)" : "var(--muted)",
                  left,
                  width: DEFAULT_SHEET_METRICS.colWidth,
                }}
              >
                {getColumnHeaderLabel(column)}
              </div>
            );
          })}
        </div>

        <div className="relative overflow-hidden border-[var(--border)] border-r bg-[rgba(248,249,250,0.92)]">
          {visibleRows.map((row) => {
            const top =
              (row - 1) * DEFAULT_SHEET_METRICS.rowHeight - viewport.scrollY;
            const isActiveRow = row === activeCell.row;

            return (
              <div
                className="absolute left-0 flex items-center border-[var(--border)] border-b px-3 font-mono text-[0.75rem] tracking-[0.18em]"
                key={`row-${row}`}
                style={{
                  backgroundColor: isActiveRow
                    ? "rgba(42,118,130,0.14)"
                    : "transparent",
                  color: isActiveRow ? "var(--foreground)" : "var(--muted)",
                  height: DEFAULT_SHEET_METRICS.rowHeight,
                  top,
                  width: "100%",
                }}
              >
                {row}
              </div>
            );
          })}
        </div>

        <div
          className="relative overflow-auto bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(249,251,252,0.98))]"
          onPointerDown={handlePointerDown}
          onScroll={handleScroll}
          ref={scrollRef}
        >
          <div
            className="relative"
            style={{
              height: gridHeight,
              width: gridWidth,
            }}
          >
            {visibleRows.flatMap((row) =>
              visibleColumns.map((column) => {
                const address = { col: column, row };
                const layout = getCellLayout(address);
                const cell = sheet.getCell(address);
                const isActive =
                  activeCell.col === column && activeCell.row === row;

                return (
                  <div
                    className="absolute overflow-hidden border-[var(--border)] border-r border-b bg-white/70 px-3 py-2 text-[0.92rem] text-[var(--foreground)] leading-6"
                    key={`${row}:${column}`}
                    style={{
                      backgroundColor: isActive
                        ? "rgba(42,118,130,0.06)"
                        : "rgba(255,255,255,0.72)",
                      height: layout.height,
                      left: layout.left,
                      top: layout.top,
                      width: layout.width,
                    }}
                  >
                    <div className="truncate">{getCellDisplayValue(cell)}</div>
                  </div>
                );
              })
            )}

            <div
              className="pointer-events-none absolute rounded-[0.7rem] border-2 border-[var(--accent)] shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
              style={{
                height: selectionRect.height,
                left: selectionRect.left,
                top: selectionRect.top,
                width: selectionRect.width,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

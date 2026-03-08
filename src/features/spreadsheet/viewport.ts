import { columnNumberToLetters } from "@/features/spreadsheet/addressing";
import {
  createAxisLayouts as createAxisLayoutsInternal,
  getCellAddressFromPoint as getCellAddressFromPointWithLayout,
  getCellLayout as getCellLayoutWithLayout,
  getGridDimensions as getGridDimensionsWithLayout,
  getViewportFromScroll as getViewportFromScrollBase,
} from "@/features/spreadsheet/sheet-layout";
import type {
  CellAddress,
  SheetBounds,
  SheetMetrics,
  Viewport,
} from "@/types/spreadsheet";

export const DEFAULT_SHEET_METRICS: SheetMetrics = {
  colWidth: 128,
  overscan: 3,
  rowHeaderWidth: 56,
  rowHeight: 34,
};

export function getColumnHeaderLabel(columnNumber: number) {
  return columnNumberToLetters(columnNumber);
}

export function getViewportFromScroll(
  args: {
    scrollX: number;
    scrollY: number;
    viewportHeight: number;
    viewportWidth: number;
  },
  bounds?: SheetBounds,
  metrics: SheetMetrics = DEFAULT_SHEET_METRICS
) {
  const viewport = getViewportFromScrollBase(args);

  if (!bounds) {
    return viewport;
  }

  const { columnLayout, rowLayout } = createAxisLayoutsInternal(
    bounds,
    metrics,
    [],
    [],
    new Map(),
    new Map()
  );
  const visibleColumns = Math.ceil(viewport.viewportWidth / metrics.colWidth);
  const visibleRows = Math.ceil(viewport.viewportHeight / metrics.rowHeight);
  const colStart =
    columnLayout.logicalToVisual[
      getCellAddressFromPointWithLayout(
        { x: args.scrollX, y: 0 },
        bounds,
        columnLayout,
        rowLayout
      ).col
    ];
  const rowStart =
    rowLayout.logicalToVisual[
      getCellAddressFromPointWithLayout(
        { x: 0, y: args.scrollY },
        bounds,
        columnLayout,
        rowLayout
      ).row
    ];

  return {
    ...viewport,
    colEnd: Math.min(bounds.colCount, colStart + visibleColumns - 1),
    colStart,
    overscan: metrics.overscan,
    rowEnd: Math.min(bounds.rowCount, rowStart + visibleRows - 1),
    rowStart,
  } satisfies Viewport;
}

export function getCellAddressFromPoint(
  point: {
    x: number;
    y: number;
  },
  bounds: SheetBounds,
  metricsOrColumnLayout:
    | SheetMetrics
    | ReturnType<
        typeof createAxisLayoutsInternal
      >["columnLayout"] = DEFAULT_SHEET_METRICS,
  rowLayout?: ReturnType<typeof createAxisLayoutsInternal>["rowLayout"]
) {
  if ("count" in metricsOrColumnLayout) {
    return getCellAddressFromPointWithLayout(
      point,
      bounds,
      metricsOrColumnLayout,
      rowLayout as ReturnType<typeof createAxisLayoutsInternal>["rowLayout"]
    );
  }

  const { columnLayout, rowLayout: nextRowLayout } = createAxisLayoutsInternal(
    bounds,
    metricsOrColumnLayout,
    [],
    [],
    new Map(),
    new Map()
  );

  return getCellAddressFromPointWithLayout(
    point,
    bounds,
    columnLayout,
    nextRowLayout
  );
}

export function getCellLayout(
  address: CellAddress,
  metricsOrColumnLayout:
    | SheetMetrics
    | ReturnType<
        typeof createAxisLayoutsInternal
      >["columnLayout"] = DEFAULT_SHEET_METRICS,
  rowLayout?: ReturnType<typeof createAxisLayoutsInternal>["rowLayout"]
) {
  if ("count" in metricsOrColumnLayout) {
    return getCellLayoutWithLayout(
      address,
      metricsOrColumnLayout,
      rowLayout as ReturnType<typeof createAxisLayoutsInternal>["rowLayout"]
    );
  }

  const bounds: SheetBounds = {
    colCount: address.col,
    rowCount: address.row,
  };
  const { columnLayout, rowLayout: nextRowLayout } = createAxisLayoutsInternal(
    bounds,
    metricsOrColumnLayout,
    [],
    [],
    new Map(),
    new Map()
  );

  return getCellLayoutWithLayout(address, columnLayout, nextRowLayout);
}

export function getGridDimensions(
  boundsOrColumnLayout:
    | SheetBounds
    | ReturnType<typeof createAxisLayoutsInternal>["columnLayout"],
  metricsOrRowLayout:
    | SheetMetrics
    | ReturnType<
        typeof createAxisLayoutsInternal
      >["rowLayout"] = DEFAULT_SHEET_METRICS
) {
  if ("count" in boundsOrColumnLayout) {
    return getGridDimensionsWithLayout(
      boundsOrColumnLayout,
      metricsOrRowLayout as ReturnType<
        typeof createAxisLayoutsInternal
      >["rowLayout"]
    );
  }

  const { columnLayout, rowLayout } = createAxisLayoutsInternal(
    boundsOrColumnLayout,
    metricsOrRowLayout as SheetMetrics,
    [],
    [],
    new Map(),
    new Map()
  );

  return getGridDimensionsWithLayout(columnLayout, rowLayout);
}

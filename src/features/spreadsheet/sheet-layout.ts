import type {
  AxisLayout,
  CellAddress,
  SheetBounds,
  SheetMetrics,
  Viewport,
} from "@/types/spreadsheet";

export const MIN_COLUMN_WIDTH = 72;
export const MIN_ROW_HEIGHT = 28;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeAxisOrder(order: number[], count: number) {
  const nextOrder: number[] = [];
  const seen = new Set<number>();

  for (const value of order) {
    if (value < 1 || value > count || seen.has(value)) {
      continue;
    }

    seen.add(value);
    nextOrder.push(value);
  }

  for (let index = 1; index <= count; index += 1) {
    if (!seen.has(index)) {
      nextOrder.push(index);
    }
  }

  return nextOrder;
}

export function createAxisLayout(args: {
  count: number;
  defaultSize: number;
  order?: number[];
  sizes?: Map<number, number>;
}) {
  const order = normalizeAxisOrder(
    args.order ?? Array.from({ length: args.count }, (_, index) => index + 1),
    args.count
  );
  const starts = new Array<number>(args.count + 1).fill(0);
  const sizes = new Array<number>(args.count + 1).fill(args.defaultSize);
  const logicalToVisual = new Array<number>(args.count + 1).fill(0);
  let totalSize = 0;

  for (let visualIndex = 1; visualIndex <= args.count; visualIndex += 1) {
    const logicalIndex = order[visualIndex - 1];
    const size = args.sizes?.get(logicalIndex) ?? args.defaultSize;

    starts[visualIndex] = totalSize;
    sizes[visualIndex] = size;
    logicalToVisual[logicalIndex] = visualIndex;
    totalSize += size;
  }

  const layout: AxisLayout = {
    count: args.count,
    defaultSize: args.defaultSize,
    logicalToVisual,
    order,
    sizes,
    starts,
    totalSize,
  };

  return layout;
}

export function getAxisLayoutByVisualIndex(
  axis: AxisLayout,
  visualIndex: number
) {
  const clampedIndex = clamp(visualIndex, 1, axis.count);

  return {
    logicalIndex: axis.order[clampedIndex - 1],
    size: axis.sizes[clampedIndex],
    start: axis.starts[clampedIndex],
    visualIndex: clampedIndex,
  };
}

export function getAxisLayoutByLogicalIndex(
  axis: AxisLayout,
  logicalIndex: number
) {
  const visualIndex = axis.logicalToVisual[logicalIndex];

  return getAxisLayoutByVisualIndex(axis, visualIndex);
}

function findVisualIndexForOffset(axis: AxisLayout, offset: number) {
  const clampedOffset = clamp(offset, 0, Math.max(0, axis.totalSize - 1));
  let low = 1;
  let high = axis.count;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const start = axis.starts[middle];
    const end = start + axis.sizes[middle];

    if (clampedOffset < start) {
      high = middle - 1;
      continue;
    }

    if (clampedOffset >= end) {
      low = middle + 1;
      continue;
    }

    return middle;
  }

  return clamp(low, 1, axis.count);
}

export function getAxisLogicalIndexAtOffset(axis: AxisLayout, offset: number) {
  return getAxisLayoutByVisualIndex(
    axis,
    findVisualIndexForOffset(axis, offset)
  ).logicalIndex;
}

export function getAxisVisibleSlice(
  axis: AxisLayout,
  scrollOffset: number,
  viewportSize: number,
  overscan: number
) {
  const safeViewportSize = Math.max(1, viewportSize);
  const startVisual = findVisualIndexForOffset(axis, scrollOffset);
  const endVisual = findVisualIndexForOffset(
    axis,
    scrollOffset + safeViewportSize - 1
  );
  const visibleStart = clamp(startVisual - overscan, 1, axis.count);
  const visibleEnd = clamp(endVisual + overscan, 1, axis.count);

  return {
    items: axis.order.slice(visibleStart - 1, visibleEnd),
    visualEnd: visibleEnd,
    visualStart: visibleStart,
  };
}

export function getCellLayout(
  address: CellAddress,
  columnLayout: AxisLayout,
  rowLayout: AxisLayout
) {
  const column = getAxisLayoutByLogicalIndex(columnLayout, address.col);
  const row = getAxisLayoutByLogicalIndex(rowLayout, address.row);

  return {
    height: row.size,
    left: column.start,
    top: row.start,
    width: column.size,
  };
}

export function getCellAddressFromPoint(
  point: {
    x: number;
    y: number;
  },
  bounds: SheetBounds,
  columnLayout: AxisLayout,
  rowLayout: AxisLayout
) {
  return {
    col: clamp(
      getAxisLogicalIndexAtOffset(columnLayout, point.x),
      1,
      bounds.colCount
    ),
    row: clamp(
      getAxisLogicalIndexAtOffset(rowLayout, point.y),
      1,
      bounds.rowCount
    ),
  };
}

export function getGridDimensions(
  columnLayout: AxisLayout,
  rowLayout: AxisLayout
) {
  return {
    height: rowLayout.totalSize,
    width: columnLayout.totalSize,
  };
}

export function getViewportFromScroll(args: {
  scrollX: number;
  scrollY: number;
  viewportHeight: number;
  viewportWidth: number;
}) {
  return {
    colEnd: 0,
    colStart: 0,
    overscan: 0,
    rowEnd: 0,
    rowStart: 0,
    scrollX: args.scrollX,
    scrollY: args.scrollY,
    viewportHeight: Math.max(1, args.viewportHeight),
    viewportWidth: Math.max(1, args.viewportWidth),
  } satisfies Viewport;
}

export function moveAxisItem(
  order: number[],
  sourceLogicalIndex: number,
  targetLogicalIndex: number
) {
  if (sourceLogicalIndex === targetLogicalIndex) {
    return order;
  }

  const sourceIndex = order.indexOf(sourceLogicalIndex);
  const targetIndex = order.indexOf(targetLogicalIndex);

  if (sourceIndex === -1 || targetIndex === -1) {
    return order;
  }

  const nextOrder = [...order];
  nextOrder.splice(sourceIndex, 1);
  nextOrder.splice(targetIndex, 0, sourceLogicalIndex);
  return nextOrder;
}

export function clampColumnWidth(width: number) {
  return Math.max(MIN_COLUMN_WIDTH, Math.round(width));
}

export function clampRowHeight(height: number) {
  return Math.max(MIN_ROW_HEIGHT, Math.round(height));
}

export function createAxisLayouts(
  bounds: SheetBounds,
  metrics: SheetMetrics,
  columnOrder: number[],
  rowOrder: number[],
  columnWidths: Map<number, number>,
  rowHeights: Map<number, number>
) {
  return {
    columnLayout: createAxisLayout({
      count: bounds.colCount,
      defaultSize: metrics.colWidth,
      order: columnOrder,
      sizes: columnWidths,
    }),
    rowLayout: createAxisLayout({
      count: bounds.rowCount,
      defaultSize: metrics.rowHeight,
      order: rowOrder,
      sizes: rowHeights,
    }),
  };
}

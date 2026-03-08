import {
  assertAddressWithinBounds,
  normalizeRange,
} from "@/features/spreadsheet/addressing";
import type {
  CellAddress,
  ChunkAddress,
  ChunkSize,
  SheetBounds,
  Viewport,
  VisibleWindow,
} from "@/types/spreadsheet";

export const DEFAULT_CHUNK_SIZE: ChunkSize = {
  colCount: 100,
  rowCount: 100,
};

export function getChunkAddress(
  address: CellAddress,
  chunkSize: ChunkSize = DEFAULT_CHUNK_SIZE
): ChunkAddress {
  return {
    col: Math.floor((address.col - 1) / chunkSize.colCount),
    row: Math.floor((address.row - 1) / chunkSize.rowCount),
  };
}

export function getChunkKey(
  chunkAddress: ChunkAddress,
  chunkSize: ChunkSize = DEFAULT_CHUNK_SIZE
) {
  return `chunk_${chunkAddress.row}_${chunkAddress.col}_${chunkSize.rowCount}x${chunkSize.colCount}`;
}

export function getChunkKeyForAddress(
  address: CellAddress,
  chunkSize: ChunkSize = DEFAULT_CHUNK_SIZE
) {
  return getChunkKey(getChunkAddress(address, chunkSize), chunkSize);
}

export function getVisibleWindow(
  viewport: Viewport,
  bounds: SheetBounds,
  overscan = viewport.overscan
): VisibleWindow {
  return {
    colEnd: Math.min(bounds.colCount, viewport.colEnd + overscan),
    colStart: Math.max(1, viewport.colStart - overscan),
    rowEnd: Math.min(bounds.rowCount, viewport.rowEnd + overscan),
    rowStart: Math.max(1, viewport.rowStart - overscan),
  };
}

export function getChunkKeysForRange(
  start: CellAddress,
  end: CellAddress,
  bounds: SheetBounds,
  chunkSize: ChunkSize = DEFAULT_CHUNK_SIZE
) {
  assertAddressWithinBounds(start, bounds);
  assertAddressWithinBounds(end, bounds);

  const normalized = normalizeRange(start, end);
  const startChunk = getChunkAddress(normalized.start, chunkSize);
  const endChunk = getChunkAddress(normalized.end, chunkSize);
  const chunkKeys: string[] = [];

  for (let row = startChunk.row; row <= endChunk.row; row += 1) {
    for (let col = startChunk.col; col <= endChunk.col; col += 1) {
      chunkKeys.push(getChunkKey({ col, row }, chunkSize));
    }
  }

  return chunkKeys;
}

export function getChunkKeysForViewport(
  viewport: Viewport,
  bounds: SheetBounds,
  chunkSize: ChunkSize = DEFAULT_CHUNK_SIZE
) {
  const visibleWindow = getVisibleWindow(viewport, bounds);
  return getChunkKeysForRange(
    {
      col: visibleWindow.colStart,
      row: visibleWindow.rowStart,
    },
    {
      col: visibleWindow.colEnd,
      row: visibleWindow.rowEnd,
    },
    bounds,
    chunkSize
  );
}

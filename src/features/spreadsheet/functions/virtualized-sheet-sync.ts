import type { CollaborationSheetChangeSet } from "@/features/collaboration/use-collaboration-room";
import { parseCellKey } from "@/features/spreadsheet/addressing";
import { moveAxisItem } from "@/features/spreadsheet/sheet-layout";
import type {
  SparseSheet,
  SparseSheetSnapshot,
} from "@/features/spreadsheet/sparse-sheet";
import type {
  HeaderDragState,
  KeyedChange,
  NumericChange,
  SnapshotChanges,
} from "@/features/spreadsheet/types/virtualized-sheet";

function areArraysEqual(left: number[], right: number[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => right[index] === value)
  );
}

function areRecordsEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function collectKeyedChanges<T>(args: {
  next: Map<string, T>;
  previous: Map<string, T>;
}) {
  const changes: KeyedChange<T>[] = [];

  for (const [key, value] of args.next) {
    if (!areRecordsEqual(args.previous.get(key), value)) {
      changes.push({
        key,
        value,
      });
    }
  }

  for (const key of args.previous.keys()) {
    if (!args.next.has(key)) {
      changes.push({
        key,
        value: null,
      });
    }
  }

  return changes;
}

function collectNumericChanges(args: {
  next: Map<number, number>;
  previous: Map<number, number>;
}) {
  const changes: NumericChange[] = [];

  for (const [index, value] of args.next) {
    if (args.previous.get(index) !== value) {
      changes.push({
        index,
        value,
      });
    }
  }

  for (const index of args.previous.keys()) {
    if (!args.next.has(index)) {
      changes.push({
        index,
        value: null,
      });
    }
  }

  return changes;
}

export function getSnapshotChanges(
  previous: SparseSheetSnapshot,
  next: SparseSheetSnapshot
): SnapshotChanges {
  return {
    cells: collectKeyedChanges({
      next: next.cells,
      previous: previous.cells,
    }),
    columnOrderChanged: !areArraysEqual(previous.columnOrder, next.columnOrder),
    columnWidths: collectNumericChanges({
      next: next.columnWidths,
      previous: previous.columnWidths,
    }),
    formats: collectKeyedChanges({
      next: next.formats,
      previous: previous.formats,
    }),
    rowHeights: collectNumericChanges({
      next: next.rowHeights,
      previous: previous.rowHeights,
    }),
    rowOrderChanged: !areArraysEqual(previous.rowOrder, next.rowOrder),
  };
}

export function hasSnapshotChanges(
  changes: SnapshotChanges,
  previous: SparseSheetSnapshot,
  next: SparseSheetSnapshot
) {
  return (
    changes.cells.length > 0 ||
    changes.columnOrderChanged ||
    changes.columnWidths.length > 0 ||
    changes.formats.length > 0 ||
    changes.rowHeights.length > 0 ||
    changes.rowOrderChanged ||
    !areArraysEqual(previous.columnOrder, next.columnOrder) ||
    !areArraysEqual(previous.rowOrder, next.rowOrder)
  );
}

export function applyRemoteChanges(args: {
  batchUpsert: (cells: Array<{ key: string; raw: string }>) => void;
  changes: CollaborationSheetChangeSet;
  deleteCell: (key: string) => void;
  markCellsDirty: () => void;
  markLayoutDirty: () => void;
  sheet: SparseSheet;
}) {
  let didCellChange = false;
  let didLayoutChange = false;
  const formulaUpserts: Array<{ key: string; raw: string }> = [];

  for (const change of args.changes.cells) {
    if (change.value === null) {
      didCellChange = args.sheet.clearCellByKey(change.key) || didCellChange;
      args.deleteCell(change.key);
      continue;
    }

    args.sheet.setCellByKey(change.key, change.value);
    formulaUpserts.push({
      key: change.key,
      raw: change.value.raw,
    });
    didCellChange = true;
  }

  for (const change of args.changes.formats) {
    if (change.value === null) {
      didCellChange =
        args.sheet.clearCellFormat(parseCellKey(change.key)) || didCellChange;
      continue;
    }

    args.sheet.setCellFormatByKey(change.key, change.value);
    didCellChange = true;
  }

  for (const change of args.changes.columnWidths) {
    args.sheet.setColumnWidth(change.index, change.value);
    didLayoutChange = true;
  }

  for (const change of args.changes.rowHeights) {
    args.sheet.setRowHeight(change.index, change.value);
    didLayoutChange = true;
  }

  if (args.changes.columnOrder) {
    args.sheet.setColumnOrder(args.changes.columnOrder);
    didLayoutChange = true;
  }

  if (args.changes.rowOrder) {
    args.sheet.setRowOrder(args.changes.rowOrder);
    didLayoutChange = true;
  }

  if (formulaUpserts.length > 0) {
    args.batchUpsert(formulaUpserts);
  }

  if (didCellChange) {
    args.markCellsDirty();
  }

  if (didLayoutChange) {
    args.markLayoutDirty();
  }
}

export function commitHeaderDrag(args: {
  applyColumnOrder: (order: number[], sync?: boolean) => void;
  applyRowOrder: (order: number[], sync?: boolean) => void;
  headerDragState: HeaderDragState;
  scheduleWriteConfirmation: () => void;
  setColumnWidth: (column: number, width: number | null) => void;
  setRowHeight: (row: number, height: number | null) => void;
  sheet: SparseSheet;
  syncDocumentTimestamp: () => void;
}) {
  if (args.headerDragState.type === "resize") {
    if (args.headerDragState.axis === "col") {
      const width = args.sheet.getColumnWidth(
        args.headerDragState.logicalIndex
      );

      if (width != null) {
        args.setColumnWidth(args.headerDragState.logicalIndex, width);
        args.scheduleWriteConfirmation();
        args.syncDocumentTimestamp();
      }

      return;
    }

    const height = args.sheet.getRowHeight(args.headerDragState.logicalIndex);

    if (height != null) {
      args.setRowHeight(args.headerDragState.logicalIndex, height);
      args.scheduleWriteConfirmation();
      args.syncDocumentTimestamp();
    }

    return;
  }

  if (
    args.headerDragState.sourceLogicalIndex ===
    args.headerDragState.targetLogicalIndex
  ) {
    return;
  }

  if (args.headerDragState.axis === "col") {
    args.applyColumnOrder(
      moveAxisItem(
        args.sheet.getColumnOrder(),
        args.headerDragState.sourceLogicalIndex,
        args.headerDragState.targetLogicalIndex
      ),
      true
    );
    return;
  }

  args.applyRowOrder(
    moveAxisItem(
      args.sheet.getRowOrder(),
      args.headerDragState.sourceLogicalIndex,
      args.headerDragState.targetLogicalIndex
    ),
    true
  );
}

"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { createCellKey } from "@/features/spreadsheet/addressing";
import {
  getOrCreateBroadcastCollaborationRoom,
  releaseBroadcastCollaborationRoom,
} from "@/lib/yjs/broadcast-collaboration-room";
import type { PresenceState } from "@/types/collaboration";
import type { SessionIdentity } from "@/types/metadata";
import type {
  CellFormatRecord,
  CellRecord,
  Selection,
} from "@/types/spreadsheet";

interface CollaborationCellChange {
  key: string;
  value: CellRecord | null;
}

interface CollaborationFormatChange {
  key: string;
  value: CellFormatRecord | null;
}

interface CollaborationMetricChange {
  index: number;
  value: number | null;
}

export interface CollaborationSheetChangeSet {
  cells: CollaborationCellChange[];
  columnOrder?: number[];
  columnWidths: CollaborationMetricChange[];
  formats: CollaborationFormatChange[];
  rowHeights: CollaborationMetricChange[];
  rowOrder?: number[];
}

const EMPTY_SNAPSHOT = {
  columnOrder: [] as number[],
  columnWidths: new Map<number, number>(),
  formats: new Map<string, CellFormatRecord>(),
  lastRemoteLatencyMs: null,
  peers: [] as PresenceState[],
  rowHeights: new Map<number, number>(),
  rowOrder: [] as number[],
  status: "idle" as const,
  values: new Map<string, CellRecord>(),
};

function noopUnsubscribe() {
  // Intentional no-op when the room is not available yet.
}

function getCellKind(raw: string): CellRecord["kind"] {
  if (raw.startsWith("=")) {
    return "formula";
  }

  if (raw.trim() !== "" && Number.isFinite(Number(raw))) {
    return "number";
  }

  return "text";
}

function toPresenceState(
  session: SessionIdentity,
  selection: Selection
): PresenceState {
  return {
    activeCell: createCellKey(
      selection.type === "cell" ? selection.anchor : selection.end
    ),
    color: session.color,
    displayName: session.displayName,
    selection:
      selection.type === "cell"
        ? undefined
        : {
            end: createCellKey(selection.end),
            start: createCellKey(selection.start),
          },
    userId: session.userId,
  };
}

function areCellRecordsEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function areNumberArraysEqual(left: number[], right: number[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => right[index] === value)
  );
}

function collectKeyedChanges<T>(args: {
  next: Map<string, T>;
  previous: Map<string, T>;
}) {
  const changes: Array<{ key: string; value: T | null }> = [];

  for (const [key, value] of args.next) {
    const previousValue = args.previous.get(key);

    if (!areCellRecordsEqual(previousValue, value)) {
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

function collectNumericMetricChanges(args: {
  next: Map<number, number>;
  previous: Map<number, number>;
}) {
  const changes: CollaborationMetricChange[] = [];

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

export function useCollaborationRoom(args: {
  initialCells: Array<{
    key: string;
    raw: string;
  }>;
  onSheetChanged: (changes: CollaborationSheetChangeSet) => void;
  roomId: string;
  selection: Selection;
  session: SessionIdentity | null;
}) {
  const sessionRef = useRef(args.session);
  sessionRef.current = args.session;
  const sessionUserId = args.session?.userId ?? null;

  const room = useMemo(() => {
    const session = sessionRef.current;

    if (!(session && sessionUserId)) {
      return null;
    }

    return getOrCreateBroadcastCollaborationRoom({
      roomId: args.roomId,
      session,
    });
  }, [args.roomId, sessionUserId]);
  const handleSheetChanges = useEffectEvent(args.onSheetChanged);
  const previousValuesRef = useRef<Map<string, CellRecord>>(new Map());
  const previousFormatsRef = useRef<Map<string, CellFormatRecord>>(new Map());
  const previousColumnWidthsRef = useRef<Map<number, number>>(new Map());
  const previousRowHeightsRef = useRef<Map<number, number>>(new Map());
  const previousColumnOrderRef = useRef<number[]>([]);
  const previousRowOrderRef = useRef<number[]>([]);

  const snapshot = useSyncExternalStore(
    (listener) => room?.subscribe(listener) ?? noopUnsubscribe,
    () => room?.getSnapshot() ?? EMPTY_SNAPSHOT,
    () => EMPTY_SNAPSHOT
  );

  const hasSeedRef = useRef(false);

  useEffect(() => {
    if (!room) {
      previousValuesRef.current = new Map();
      previousFormatsRef.current = new Map();
      previousColumnWidthsRef.current = new Map();
      previousRowHeightsRef.current = new Map();
      previousColumnOrderRef.current = [];
      previousRowOrderRef.current = [];
      hasSeedRef.current = false;
      return;
    }

    return () => {
      previousValuesRef.current = new Map();
      previousFormatsRef.current = new Map();
      previousColumnWidthsRef.current = new Map();
      previousRowHeightsRef.current = new Map();
      previousColumnOrderRef.current = [];
      previousRowOrderRef.current = [];
      hasSeedRef.current = false;
      releaseBroadcastCollaborationRoom(args.roomId);
    };
  }, [args.roomId, room]);

  useEffect(() => {
    if (
      !room ||
      hasSeedRef.current ||
      args.initialCells.length === 0 ||
      snapshot.status === "connecting"
    ) {
      return;
    }

    if (snapshot.values.size === 0) {
      room.batchUpsert(args.initialCells);
    }

    hasSeedRef.current = true;
  }, [args.initialCells, room, snapshot.status, snapshot.values.size]);

  useEffect(() => {
    const cells = collectKeyedChanges({
      next: snapshot.values,
      previous: previousValuesRef.current,
    });
    const formats = collectKeyedChanges({
      next: snapshot.formats,
      previous: previousFormatsRef.current,
    });
    const columnWidths = collectNumericMetricChanges({
      next: snapshot.columnWidths,
      previous: previousColumnWidthsRef.current,
    });
    const rowHeights = collectNumericMetricChanges({
      next: snapshot.rowHeights,
      previous: previousRowHeightsRef.current,
    });

    const didColumnOrderChange = !areNumberArraysEqual(
      previousColumnOrderRef.current,
      snapshot.columnOrder
    );
    const didRowOrderChange = !areNumberArraysEqual(
      previousRowOrderRef.current,
      snapshot.rowOrder
    );

    previousValuesRef.current = new Map(snapshot.values);
    previousFormatsRef.current = new Map(snapshot.formats);
    previousColumnWidthsRef.current = new Map(snapshot.columnWidths);
    previousRowHeightsRef.current = new Map(snapshot.rowHeights);
    previousColumnOrderRef.current = [...snapshot.columnOrder];
    previousRowOrderRef.current = [...snapshot.rowOrder];

    if (
      cells.length > 0 ||
      formats.length > 0 ||
      columnWidths.length > 0 ||
      rowHeights.length > 0 ||
      didColumnOrderChange ||
      didRowOrderChange
    ) {
      handleSheetChanges({
        cells,
        columnOrder: didColumnOrderChange ? snapshot.columnOrder : undefined,
        columnWidths,
        formats,
        rowHeights,
        rowOrder: didRowOrderChange ? snapshot.rowOrder : undefined,
      });
    }
  }, [
    snapshot.columnOrder,
    snapshot.columnWidths,
    snapshot.formats,
    snapshot.rowHeights,
    snapshot.rowOrder,
    snapshot.values,
  ]);

  useEffect(() => {
    if (!(room && args.session)) {
      return;
    }

    room.setPresence(toPresenceState(args.session, args.selection));
  }, [args.selection, args.session, room]);

  return {
    batchFormat: (
      formats: Array<{
        format: CellFormatRecord | null;
        key: string;
      }>
    ) => {
      room?.batchFormat(formats);
    },
    batchUpsert: (
      cells: Array<{
        key: string;
        raw: string;
      }>
    ) => {
      room?.batchUpsert(cells);
    },
    lastRemoteLatencyMs: snapshot.lastRemoteLatencyMs,
    peers: snapshot.peers,
    setCellFormat: (entry: {
      format: CellFormatRecord | null;
      key: string;
    }) => {
      room?.setCellFormat(entry.key, entry.format);
    },
    setColumnOrder: (order: number[]) => {
      room?.setColumnOrder(order);
    },
    setColumnWidth: (column: number, width: number | null) => {
      room?.setColumnWidth(column, width);
    },
    setRowHeight: (row: number, height: number | null) => {
      room?.setRowHeight(row, height);
    },
    setRowOrder: (order: number[]) => {
      room?.setRowOrder(order);
    },
    status: snapshot.status,
    upsertCell: (cell: { key: string; raw: string }) => {
      if (!room) {
        return;
      }

      if (cell.raw.trim() === "") {
        room.deleteCell(cell.key);
        return;
      }

      room.upsertCell(cell.key, {
        kind: getCellKind(cell.raw),
        raw: cell.raw,
      });
    },
  };
}

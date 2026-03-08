"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { createCellKey } from "@/features/spreadsheet/addressing";
import { getSelectionBounds } from "@/features/spreadsheet/interaction";
import {
  getOrCreateBroadcastCollaborationRoom,
  releaseBroadcastCollaborationRoom,
} from "@/lib/yjs/broadcast-collaboration-room";
import type { PresenceState } from "@/types/collaboration";
import type { SessionIdentity } from "@/types/metadata";
import type { CellRecord, Selection } from "@/types/spreadsheet";

interface CollaborationCellChange {
  key: string;
  value: CellRecord | null;
}

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
  const bounds = getSelectionBounds(selection);

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
            end: createCellKey(bounds.end),
            start: createCellKey(bounds.start),
          },
    userId: session.userId,
  };
}

function areCellRecordsEqual(
  left: CellRecord | undefined,
  right: CellRecord | undefined
) {
  return (
    left?.kind === right?.kind &&
    left?.raw === right?.raw &&
    left?.updatedAt === right?.updatedAt &&
    left?.updatedBy === right?.updatedBy
  );
}

function createEmptySnapshot() {
  return {
    lastRemoteLatencyMs: null,
    peers: [] as PresenceState[],
    status: "idle" as const,
    values: new Map<string, CellRecord>(),
  };
}

export function useCollaborationRoom(args: {
  initialCells: Array<{
    key: string;
    raw: string;
  }>;
  onCellsChanged: (changes: CollaborationCellChange[]) => void;
  roomId: string;
  selection: Selection;
  session: SessionIdentity | null;
}) {
  const room = useMemo(() => {
    if (!args.session) {
      return null;
    }

    return getOrCreateBroadcastCollaborationRoom({
      roomId: args.roomId,
      session: args.session,
    });
  }, [args.roomId, args.session]);
  const handleCellChanges = useEffectEvent(args.onCellsChanged);
  const previousValuesRef = useRef<Map<string, CellRecord>>(new Map());

  const snapshot = useSyncExternalStore(
    (listener) => room?.subscribe(listener) ?? noopUnsubscribe,
    () => room?.getSnapshot() ?? createEmptySnapshot(),
    createEmptySnapshot
  );

  useEffect(() => {
    if (!room) {
      previousValuesRef.current = new Map();
      return;
    }

    if (room.getSnapshot().values.size === 0 && args.initialCells.length > 0) {
      room.batchUpsert(args.initialCells);
    }

    return () => {
      previousValuesRef.current = new Map();
      releaseBroadcastCollaborationRoom(args.roomId);
    };
  }, [args.initialCells, args.roomId, room]);

  useEffect(() => {
    const changes: CollaborationCellChange[] = [];
    const previousValues = previousValuesRef.current;
    const nextValues = snapshot.values;

    for (const [key, value] of nextValues) {
      const previousValue = previousValues.get(key);

      if (!areCellRecordsEqual(previousValue, value)) {
        changes.push({
          key,
          value,
        });
      }
    }

    for (const key of previousValues.keys()) {
      if (!nextValues.has(key)) {
        changes.push({
          key,
          value: null,
        });
      }
    }

    previousValuesRef.current = new Map(nextValues);

    if (changes.length > 0) {
      handleCellChanges(changes);
    }
  }, [snapshot.values]);

  useEffect(() => {
    if (!(room && args.session)) {
      return;
    }

    room.setPresence(toPresenceState(args.session, args.selection));
  }, [args.selection, args.session, room]);

  return {
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

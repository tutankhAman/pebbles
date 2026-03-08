"use client";

import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
import {
  applyUpdate,
  Doc,
  encodeStateAsUpdate,
  type Array as YArray,
  type Map as YMap,
} from "yjs";
import {
  loadPersistedRoomState,
  persistRoomState,
} from "@/lib/yjs/room-persistence";
import {
  decodeTransportFrame,
  encodeTransportFrame,
  TRANSPORT_MESSAGE_TYPE,
} from "@/lib/yjs/transport-protocol";
import type { CollaborationStatus, PresenceState } from "@/types/collaboration";
import type { SessionIdentity } from "@/types/metadata";
import type { CellFormatRecord, CellRecord } from "@/types/spreadsheet";

const ROOM_CHANNEL_PREFIX = "pebbles-room:";
const REMOTE_AWARENESS_ORIGIN = "pebbles-remote-awareness";
const REMOTE_SYNC_ORIGIN = "pebbles-remote-sync";
const TRAILING_SLASH_PATTERN = /\/$/;
const STATUS_SETTLE_DELAY_MS = 180;
const WEBSOCKET_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const YJS_SYNC_ORIGIN = "pebbles-broadcast-sync";

type BroadcastMessage =
  | {
      senderId: string;
      type: "awareness-update";
      update: Uint8Array;
    }
  | {
      senderId: string;
      type: "sync-request";
    }
  | {
      senderId: string;
      type: "sync-response";
      update: Uint8Array;
    }
  | {
      senderId: string;
      type: "yjs-update";
      update: Uint8Array;
    };

interface CollaborationSnapshot {
  columnOrder: number[];
  columnWidths: Map<number, number>;
  formats: Map<string, CellFormatRecord>;
  lastRemoteLatencyMs: number | null;
  peers: PresenceState[];
  rowHeights: Map<number, number>;
  rowOrder: number[];
  status: CollaborationStatus;
  values: Map<string, CellRecord>;
}

function mapNumericEntries(values: YMap<number>) {
  return new Map(
    Array.from(values.entries()).map(([key, value]) => [Number(key), value])
  );
}

function createChannelName(roomId: string) {
  return `${ROOM_CHANNEL_PREFIX}${roomId}`;
}

function nextSenderId() {
  return crypto.randomUUID();
}

function createLocalPresence(identity: SessionIdentity): PresenceState {
  return {
    color: identity.color,
    displayName: identity.displayName,
    userId: identity.userId,
  };
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

export class BroadcastCollaborationRoom {
  private readonly awareness: Awareness;
  private readonly cells: YMap<CellRecord>;
  private readonly channel: BroadcastChannel;
  private readonly columnOrder: YArray<number>;
  private readonly columnWidths: YMap<number>;
  private readonly doc: Doc;
  private readonly formats: YMap<CellFormatRecord>;
  private readonly listeners = new Set<() => void>();
  private readonly roomId: string;
  private readonly rowHeights: YMap<number>;
  private readonly rowOrder: YArray<number>;
  private readonly senderId = nextSenderId();
  private readonly session: SessionIdentity;
  private isDestroyed = false;

  get destroyed() {
    return this.isDestroyed;
  }
  private lastRemoteLatencyMs: number | null = null;
  private reconnectTimerId: number | null = null;
  private snapshot: CollaborationSnapshot;
  private socket: WebSocket | null = null;
  private socketReconnectAttempt = 0;
  private socketReconnectTimerId: number | null = null;
  private status: CollaborationStatus = "connecting";

  constructor(args: {
    roomId: string;
    session: SessionIdentity;
  }) {
    this.roomId = args.roomId;
    this.session = args.session;
    this.doc = new Doc();
    this.cells = this.doc.getMap<CellRecord>("cells");
    this.formats = this.doc.getMap<CellFormatRecord>("formats");
    this.columnWidths = this.doc.getMap<number>("column-widths");
    this.rowHeights = this.doc.getMap<number>("row-heights");
    this.columnOrder = this.doc.getArray<number>("column-order");
    this.rowOrder = this.doc.getArray<number>("row-order");
    this.awareness = new Awareness(this.doc);
    this.channel = new BroadcastChannel(createChannelName(args.roomId));
    this.snapshot = this.createSnapshot();

    this.hydratePersistedState();
    this.bindDocUpdates();
    this.bindAwarenessUpdates();
    this.bindBroadcastChannel();
    this.bindWindowStatus();

    this.awareness.setLocalState(createLocalPresence(args.session));
    this.status = this.getInitialStatus();
    this.notify();
    this.channel.postMessage({
      senderId: this.senderId,
      type: "sync-request",
    } satisfies BroadcastMessage);
    this.connectRemoteTransport();
  }

  batchUpsert(
    cells: Array<{
      key: string;
      raw: string;
    }>
  ) {
    if (cells.length === 0) {
      return;
    }

    this.doc.transact(() => {
      for (const cell of cells) {
        if (cell.raw.trim() === "") {
          this.cells.delete(cell.key);
          continue;
        }

        this.cells.set(cell.key, {
          kind: getCellKind(cell.raw),
          raw: cell.raw,
          updatedAt: Date.now(),
          updatedBy: this.session.userId,
        });
      }
    }, this.senderId);
  }

  deleteCell(cellKey: string) {
    this.doc.transact(() => {
      this.cells.delete(cellKey);
    }, this.senderId);
  }

  setCellFormat(cellKey: string, format: CellFormatRecord | null) {
    this.doc.transact(() => {
      if (format == null) {
        this.formats.delete(cellKey);
        return;
      }

      this.formats.set(cellKey, {
        ...format,
        updatedAt: Date.now(),
        updatedBy: this.session.userId,
      });
    }, this.senderId);
  }

  batchFormat(
    formats: Array<{
      format: CellFormatRecord | null;
      key: string;
    }>
  ) {
    if (formats.length === 0) {
      return;
    }

    this.doc.transact(() => {
      for (const entry of formats) {
        if (entry.format == null) {
          this.formats.delete(entry.key);
          continue;
        }

        this.formats.set(entry.key, {
          ...entry.format,
          updatedAt: Date.now(),
          updatedBy: this.session.userId,
        });
      }
    }, this.senderId);
  }

  setColumnWidth(column: number, width: number | null) {
    this.doc.transact(() => {
      if (width == null) {
        this.columnWidths.delete(String(column));
        return;
      }

      this.columnWidths.set(String(column), width);
    }, this.senderId);
  }

  setRowHeight(row: number, height: number | null) {
    this.doc.transact(() => {
      if (height == null) {
        this.rowHeights.delete(String(row));
        return;
      }

      this.rowHeights.set(String(row), height);
    }, this.senderId);
  }

  setColumnOrder(order: number[]) {
    this.doc.transact(() => {
      this.columnOrder.delete(0, this.columnOrder.length);
      this.columnOrder.insert(0, order);
    }, this.senderId);
  }

  setRowOrder(order: number[]) {
    this.doc.transact(() => {
      this.rowOrder.delete(0, this.rowOrder.length);
      this.rowOrder.insert(0, order);
    }, this.senderId);
  }

  destroy() {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;
    this.listeners.clear();
    this.socket?.close();
    this.socket = null;
    this.awareness.destroy();
    this.doc.destroy();
    this.channel.close();

    if (this.reconnectTimerId !== null) {
      window.clearTimeout(this.reconnectTimerId);
      this.reconnectTimerId = null;
    }

    if (this.socketReconnectTimerId !== null) {
      window.clearTimeout(this.socketReconnectTimerId);
      this.socketReconnectTimerId = null;
    }
  }

  getSnapshot(): CollaborationSnapshot {
    return this.snapshot;
  }

  setPresence(nextPresence: Partial<PresenceState>) {
    const current = (this.awareness.getLocalState() ??
      createLocalPresence(this.session)) as PresenceState;

    this.awareness.setLocalState({
      ...current,
      ...nextPresence,
    });
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  upsertCell(cellKey: string, cell: CellRecord) {
    this.doc.transact(() => {
      this.cells.set(cellKey, {
        ...cell,
        updatedAt: Date.now(),
        updatedBy: this.session.userId,
      });
    }, this.senderId);
  }

  private bindAwarenessUpdates() {
    this.awareness.on(
      "update",
      (
        {
          added,
          removed,
          updated,
        }: { added: number[]; removed: number[]; updated: number[] },
        origin: unknown
      ) => {
        const changedClients = [...added, ...updated, ...removed];

        if (changedClients.length === 0) {
          return;
        }

        if (
          !this.isDestroyed &&
          origin !== REMOTE_AWARENESS_ORIGIN &&
          origin !== YJS_SYNC_ORIGIN &&
          origin !== this
        ) {
          const update = encodeAwarenessUpdate(this.awareness, changedClients);

          this.postChannelMessage({
            senderId: this.senderId,
            type: "awareness-update",
            update,
          } satisfies BroadcastMessage);
          this.sendRemoteFrame(TRANSPORT_MESSAGE_TYPE.awarenessUpdate, update);
        }

        this.notify();
      }
    );
  }

  private bindBroadcastChannel() {
    this.channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      const message = event.data;

      if (message.senderId === this.senderId) {
        return;
      }

      switch (message.type) {
        case "awareness-update":
          applyAwarenessUpdate(this.awareness, message.update, YJS_SYNC_ORIGIN);
          this.notify();
          break;
        case "sync-request":
          this.postChannelMessage({
            senderId: this.senderId,
            type: "sync-response",
            update: encodeStateAsUpdate(this.doc),
          } satisfies BroadcastMessage);
          break;
        case "sync-response":
        case "yjs-update":
          applyUpdate(this.doc, message.update, YJS_SYNC_ORIGIN);
          break;
        default:
          break;
      }
    };
  }

  private bindDocUpdates() {
    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      persistRoomState(this.roomId, encodeStateAsUpdate(this.doc));

      if (
        !(
          this.isDestroyed ||
          origin === YJS_SYNC_ORIGIN ||
          origin === REMOTE_SYNC_ORIGIN
        )
      ) {
        this.postChannelMessage({
          senderId: this.senderId,
          type: "yjs-update",
          update,
        } satisfies BroadcastMessage);
        this.sendRemoteFrame(TRANSPORT_MESSAGE_TYPE.yjsUpdate, update);
      }

      this.lastRemoteLatencyMs = this.computeRemoteLatency();
      this.notify();
    });
  }

  private bindWindowStatus() {
    const handleOffline = () => {
      this.status = "offline";
      this.socket?.close();
      this.notify();
    };

    const handleOnline = () => {
      this.setStatus(this.hasRemoteTransport() ? "reconnecting" : "connected");
      this.connectRemoteTransport();

      if (this.reconnectTimerId !== null) {
        window.clearTimeout(this.reconnectTimerId);
      }

      this.reconnectTimerId = window.setTimeout(() => {
        if (!this.hasRemoteTransport()) {
          this.setStatus("connected");
        }
      }, STATUS_SETTLE_DELAY_MS);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    const teardown = () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };

    this.doc.on("destroy", teardown);
  }

  private connectRemoteTransport() {
    if (!(this.hasRemoteTransport() && navigator.onLine)) {
      return;
    }

    if (this.socket) {
      const { readyState } = this.socket;

      if (
        readyState === WebSocket.CONNECTING ||
        readyState === WebSocket.OPEN
      ) {
        return;
      }

      this.socket = null;
    }

    const socket = new WebSocket(this.getRemoteTransportUrl());
    socket.binaryType = "arraybuffer";
    this.socket = socket;

    socket.onopen = () => {
      this.socketReconnectAttempt = 0;
      this.setStatus("connected");
      this.sendRemoteFrame(
        TRANSPORT_MESSAGE_TYPE.syncState,
        encodeStateAsUpdate(this.doc)
      );
      this.sendCurrentAwareness();
    };

    socket.onmessage = (event) => {
      const frame = decodeTransportFrame(event.data);

      switch (frame.type) {
        case TRANSPORT_MESSAGE_TYPE.syncState:
        case TRANSPORT_MESSAGE_TYPE.yjsUpdate:
          applyUpdate(this.doc, frame.payload, REMOTE_SYNC_ORIGIN);
          break;
        case TRANSPORT_MESSAGE_TYPE.awarenessUpdate:
          applyAwarenessUpdate(
            this.awareness,
            frame.payload,
            REMOTE_AWARENESS_ORIGIN
          );
          this.notify();
          break;
        default:
          break;
      }
    };

    socket.onerror = () => {
      socket.close();
    };

    socket.onclose = () => {
      if (this.socket !== socket) {
        return;
      }

      this.socket = null;

      if (
        !(this.isDestroyed || !navigator.onLine || !this.hasRemoteTransport())
      ) {
        this.setStatus("reconnecting");
        this.scheduleRemoteReconnect();
      }
    };
  }

  private computeRemoteLatency() {
    let nextLatency: number | null = null;

    for (const value of this.cells.values()) {
      if (
        !(
          value.updatedAt &&
          value.updatedBy &&
          value.updatedBy !== this.session.userId
        )
      ) {
        continue;
      }

      nextLatency = Date.now() - value.updatedAt;
      break;
    }

    return nextLatency;
  }

  private createSnapshot(): CollaborationSnapshot {
    const peers = Array.from(this.awareness.getStates().values())
      .map((state) => state as PresenceState)
      .filter((state) => state.userId !== this.session.userId);

    return {
      columnOrder: this.columnOrder.toArray(),
      columnWidths: mapNumericEntries(this.columnWidths),
      formats: new Map(
        Array.from(this.formats.entries()).flatMap(([key, value]) =>
          value ? [[key, value] as const] : []
        )
      ),
      lastRemoteLatencyMs: this.lastRemoteLatencyMs,
      peers,
      rowHeights: mapNumericEntries(this.rowHeights),
      rowOrder: this.rowOrder.toArray(),
      status: this.status,
      values: new Map(
        Array.from(this.cells.entries()).flatMap(([key, value]) =>
          value ? [[key, value] as const] : []
        )
      ),
    };
  }

  private getInitialStatus() {
    if (!navigator.onLine) {
      return "offline";
    }

    return this.hasRemoteTransport() ? "connecting" : "connected";
  }

  private getRemoteTransportUrl() {
    const url = new URL(WEBSOCKET_BASE_URL as string);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `${url.pathname.replace(TRAILING_SLASH_PATTERN, "")}/ws/rooms/${this.roomId}`;

    url.searchParams.set("clientId", String(this.doc.clientID));
    url.searchParams.set("color", this.session.color);
    url.searchParams.set("displayName", this.session.displayName);
    url.searchParams.set("userId", this.session.userId);

    return url.toString();
  }

  private hasRemoteTransport() {
    return typeof WEBSOCKET_BASE_URL === "string" && WEBSOCKET_BASE_URL !== "";
  }

  private hydratePersistedState() {
    const persistedUpdate = loadPersistedRoomState(this.roomId);

    if (persistedUpdate) {
      applyUpdate(this.doc, persistedUpdate, YJS_SYNC_ORIGIN);
    }
  }

  private scheduleRemoteReconnect() {
    if (this.socketReconnectTimerId !== null) {
      window.clearTimeout(this.socketReconnectTimerId);
    }

    const attempt = this.socketReconnectAttempt + 1;
    this.socketReconnectAttempt = attempt;

    const delay = Math.min(1500, 150 * 2 ** (attempt - 1));

    this.socketReconnectTimerId = window.setTimeout(() => {
      this.socketReconnectTimerId = null;
      this.connectRemoteTransport();
    }, delay);
  }

  private sendCurrentAwareness() {
    const localState = this.awareness.getLocalState();

    if (!localState) {
      return;
    }

    const update = encodeAwarenessUpdate(this.awareness, [this.doc.clientID]);
    this.sendRemoteFrame(TRANSPORT_MESSAGE_TYPE.awarenessUpdate, update);
  }

  private sendRemoteFrame(
    type: (typeof TRANSPORT_MESSAGE_TYPE)[keyof typeof TRANSPORT_MESSAGE_TYPE],
    payload: Uint8Array
  ) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(encodeTransportFrame(type, payload));
  }

  private setStatus(nextStatus: CollaborationStatus) {
    this.status = nextStatus;
    this.notify();
  }

  private notify() {
    this.snapshot = this.createSnapshot();

    for (const listener of this.listeners) {
      listener();
    }
  }

  private postChannelMessage(message: BroadcastMessage) {
    if (this.isDestroyed) {
      return;
    }

    try {
      this.channel.postMessage(message);
    } catch (error) {
      if (error instanceof DOMException && error.name === "InvalidStateError") {
        return;
      }

      throw error;
    }
  }
}

const RELEASE_DEFER_MS = 100;

const roomRegistry = new Map<string, BroadcastCollaborationRoom>();
const roomRefCounts = new Map<string, number>();
const roomReleaseTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function getOrCreateBroadcastCollaborationRoom(args: {
  roomId: string;
  session: SessionIdentity;
}) {
  const pendingRelease = roomReleaseTimers.get(args.roomId);

  if (pendingRelease !== undefined) {
    clearTimeout(pendingRelease);
    roomReleaseTimers.delete(args.roomId);
  }

  const existingRoom = roomRegistry.get(args.roomId);

  if (existingRoom && !existingRoom.destroyed) {
    existingRoom.setPresence(createLocalPresence(args.session));
    roomRefCounts.set(args.roomId, (roomRefCounts.get(args.roomId) ?? 0) + 1);
    return existingRoom;
  }

  const room = new BroadcastCollaborationRoom(args);
  roomRegistry.set(args.roomId, room);
  roomRefCounts.set(args.roomId, 1);
  return room;
}

export function releaseBroadcastCollaborationRoom(roomId: string) {
  const count = (roomRefCounts.get(roomId) ?? 1) - 1;
  roomRefCounts.set(roomId, count);

  if (count > 0) {
    return;
  }

  const timerId = setTimeout(() => {
    roomReleaseTimers.delete(roomId);

    const room = roomRegistry.get(roomId);

    if (!room) {
      return;
    }

    room.destroy();
    roomRegistry.delete(roomId);
    roomRefCounts.delete(roomId);
  }, RELEASE_DEFER_MS);

  roomReleaseTimers.set(roomId, timerId);
}

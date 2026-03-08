import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { applyUpdate, Doc, encodeStateAsUpdate } from "yjs";
import {
  decodeTransportFrame,
  encodeTransportFrame,
  TRANSPORT_MESSAGE_TYPE,
} from "./transport-protocol";

/**
 * CollabDocument Durable Object
 *
 * One instance per document/room. Manages:
 * - Yjs document state and awareness
 * - WebSocket connections via Hibernation API
 * - Persistence to DO SQLite storage
 * - Broadcasting updates between connected clients
 */
export class CollabDocument implements DurableObject {
  private awareness: Awareness | null = null;
  private doc: Doc | null = null;
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    );
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const clientId = Number(url.searchParams.get("clientId"));

    if (!Number.isSafeInteger(clientId) || clientId <= 0) {
      return new Response("Invalid clientId", { status: 400 });
    }

    await this.ensureLoaded();

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    this.state.acceptWebSocket(server, [String(clientId)]);
    this.sendSnapshot(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(
    ws: WebSocket,
    message: ArrayBuffer | string
  ): Promise<void> {
    if (typeof message === "string") {
      return;
    }

    await this.ensureLoaded();

    const doc = this.doc as Doc;
    const awareness = this.awareness as Awareness;
    const frame = decodeTransportFrame(message);

    switch (frame.type) {
      case TRANSPORT_MESSAGE_TYPE.syncState:
      case TRANSPORT_MESSAGE_TYPE.yjsUpdate:
        applyUpdate(doc, frame.payload, ws);
        break;
      case TRANSPORT_MESSAGE_TYPE.awarenessUpdate:
        applyAwarenessUpdate(awareness, frame.payload, ws);
        break;
      default:
        break;
    }
  }

  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean
  ): Promise<void> {
    await this.ensureLoaded();
    this.handleDisconnect(ws);
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    await this.ensureLoaded();
    this.handleDisconnect(ws);
  }

  private handleDisconnect(ws: WebSocket): void {
    const awareness = this.awareness as Awareness;
    const tags = this.state.getTags(ws);
    const clientId = tags.length > 0 ? Number(tags[0]) : null;

    if (clientId !== null && Number.isSafeInteger(clientId)) {
      removeAwarenessStates(awareness, [clientId], ws);
    }

    try {
      ws.close(1011, "WebSocket closed");
    } catch {
      // Already closed
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (this.doc) {
      return;
    }

    const doc = new Doc();
    const awareness = new Awareness(doc);

    // Load persisted state from SQLite
    const stored = await this.state.storage.get<Uint8Array>("yjs-state");

    if (stored) {
      applyUpdate(doc, stored, "persisted-state");
    }

    // Wire doc update handler: persist + broadcast
    doc.on("update", (update: Uint8Array, origin: unknown) => {
      this.persistState();

      const frame = encodeTransportFrame(
        TRANSPORT_MESSAGE_TYPE.yjsUpdate,
        update
      );

      this.broadcast(frame, isWebSocketOrigin(origin) ? origin : undefined);
    });

    // Wire awareness update handler: broadcast
    awareness.on(
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

        const frame = encodeTransportFrame(
          TRANSPORT_MESSAGE_TYPE.awarenessUpdate,
          encodeAwarenessUpdate(awareness, changedClients)
        );

        this.broadcast(frame, isWebSocketOrigin(origin) ? origin : undefined);
      }
    );

    this.doc = doc;
    this.awareness = awareness;
  }

  private persistState(): void {
    if (!this.doc) {
      return;
    }

    const update = encodeStateAsUpdate(this.doc);
    this.state.storage.put("yjs-state", update);
  }

  private broadcast(frame: Uint8Array, exclude?: WebSocket): void {
    for (const ws of this.state.getWebSockets()) {
      if (ws === exclude) {
        continue;
      }

      try {
        ws.send(frame);
      } catch {
        // Socket may have been closed between iteration and send
      }
    }
  }

  private sendSnapshot(ws: WebSocket): void {
    if (!(this.doc && this.awareness)) {
      return;
    }

    // Send full document state
    ws.send(
      encodeTransportFrame(
        TRANSPORT_MESSAGE_TYPE.syncState,
        encodeStateAsUpdate(this.doc)
      )
    );

    // Send current awareness states
    const activeClients = Array.from(this.awareness.getStates().keys());

    if (activeClients.length === 0) {
      return;
    }

    ws.send(
      encodeTransportFrame(
        TRANSPORT_MESSAGE_TYPE.awarenessUpdate,
        encodeAwarenessUpdate(this.awareness, activeClients)
      )
    );
  }
}

function isWebSocketOrigin(origin: unknown): origin is WebSocket {
  return (
    origin !== null &&
    typeof origin === "object" &&
    "send" in (origin as Record<string, unknown>)
  );
}

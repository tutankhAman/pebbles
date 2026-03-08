/* global Bun */

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
} from "../../src/lib/yjs/transport-protocol.ts";
import {
  loadPersistedRoomState,
  persistRoomState,
} from "./room-persistence.mjs";

const ROOM_PERSIST_DELAY_MS = 160;
const ROOM_IDLE_EVICTION_MS = 60_000;
const SERVER_HOST = process.env.COLLAB_SERVER_HOST ?? "0.0.0.0";
const SERVER_PORT = Number(process.env.COLLAB_SERVER_PORT ?? 8787);
const VALID_ROOM_ID_PATTERN = /^[A-Za-z0-9-]{8,128}$/;

const roomRegistry = new Map();

function assertValidRoomId(roomId) {
  return VALID_ROOM_ID_PATTERN.test(roomId);
}

function broadcastFrame(room, frame, excludedSocket) {
  for (const socket of room.sockets) {
    if (socket === excludedSocket || socket.readyState !== WebSocket.OPEN) {
      continue;
    }

    socket.send(frame);
  }
}

function clearIdleEviction(room) {
  if (room.idleTimer !== null) {
    clearTimeout(room.idleTimer);
    room.idleTimer = null;
  }
}

function isWebSocketOrigin(origin) {
  return Boolean(origin && typeof origin.send === "function");
}

async function persistRoom(room) {
  room.persistTimer = null;
  const update = encodeStateAsUpdate(room.doc);
  await persistRoomState(room.roomId, update);
}

function schedulePersist(room) {
  if (room.persistTimer !== null) {
    clearTimeout(room.persistTimer);
  }

  room.persistTimer = setTimeout(() => {
    persistRoom(room).catch((error) => {
      console.error("Failed to persist collaboration room", error);
    });
  }, ROOM_PERSIST_DELAY_MS);
}

function scheduleIdleEviction(room) {
  clearIdleEviction(room);
  room.idleTimer = setTimeout(() => {
    if (room.sockets.size > 0) {
      return;
    }

    persistRoom(room)
      .catch((error) => {
        console.error("Failed to persist room before eviction", error);
      })
      .finally(() => {
        room.awareness.destroy();
        room.doc.destroy();
        roomRegistry.delete(room.roomId);
      });
  }, ROOM_IDLE_EVICTION_MS);
}

function wireRoom(room) {
  room.doc.on("update", (update, origin) => {
    schedulePersist(room);
    const frame = encodeTransportFrame(
      TRANSPORT_MESSAGE_TYPE.yjsUpdate,
      update
    );
    broadcastFrame(room, frame, isWebSocketOrigin(origin) ? origin : undefined);
  });

  room.awareness.on("update", ({ added, removed, updated }, origin) => {
    const changedClients = [...added, ...updated, ...removed];

    if (changedClients.length === 0) {
      return;
    }

    const frame = encodeTransportFrame(
      TRANSPORT_MESSAGE_TYPE.awarenessUpdate,
      encodeAwarenessUpdate(room.awareness, changedClients)
    );

    broadcastFrame(room, frame, isWebSocketOrigin(origin) ? origin : undefined);
  });
}

async function createRoom(roomId) {
  const doc = new Doc();
  const awareness = new Awareness(doc);
  const persistedUpdate = await loadPersistedRoomState(roomId);

  if (persistedUpdate) {
    applyUpdate(doc, persistedUpdate, "persisted-room-state");
  }

  const room = {
    awareness,
    doc,
    idleTimer: null,
    persistTimer: null,
    roomId,
    sockets: new Set(),
  };

  wireRoom(room);
  return room;
}

const pendingRoomCreations = new Map();

async function getOrCreateRoom(roomId) {
  const existingRoom = roomRegistry.get(roomId);

  if (existingRoom) {
    clearIdleEviction(existingRoom);
    return existingRoom;
  }

  const pendingCreation = pendingRoomCreations.get(roomId);

  if (pendingCreation) {
    return await pendingCreation;
  }

  const creation = createRoom(roomId).then((room) => {
    roomRegistry.set(roomId, room);
    pendingRoomCreations.delete(roomId);
    return room;
  });

  pendingRoomCreations.set(roomId, creation);
  return await creation;
}

function getRoomIdFromUrl(requestUrl) {
  const url = new URL(requestUrl);
  const pathParts = url.pathname.split("/").filter(Boolean);

  if (pathParts.length === 0 || pathParts.at(-2) !== "rooms") {
    return null;
  }

  const roomId = pathParts.at(-1) ?? null;
  return roomId && assertValidRoomId(roomId) ? roomId : null;
}

function sendSnapshot(socket, room) {
  socket.send(
    encodeTransportFrame(
      TRANSPORT_MESSAGE_TYPE.syncState,
      encodeStateAsUpdate(room.doc)
    )
  );

  const activeClients = Array.from(room.awareness.getStates().keys());

  if (activeClients.length === 0) {
    return;
  }

  socket.send(
    encodeTransportFrame(
      TRANSPORT_MESSAGE_TYPE.awarenessUpdate,
      encodeAwarenessUpdate(room.awareness, activeClients)
    )
  );
}

// biome-ignore lint/correctness/noUndeclaredVariables: Bun provides the websocket server runtime.
const server = Bun.serve({
  fetch: async (request, serverInstance) => {
    const roomId = getRoomIdFromUrl(request.url);

    if (!roomId) {
      return new Response("Not found", {
        status: 404,
      });
    }

    const url = new URL(request.url);
    const clientId = Number(url.searchParams.get("clientId"));

    if (!Number.isSafeInteger(clientId) || clientId <= 0) {
      return new Response("Invalid clientId", {
        status: 400,
      });
    }

    const room = await getOrCreateRoom(roomId);
    const upgraded = serverInstance.upgrade(request, {
      data: {
        clientId,
        room,
      },
    });

    if (!upgraded) {
      return new Response("Upgrade failed", {
        status: 426,
      });
    }

    return undefined;
  },
  hostname: SERVER_HOST,
  port: SERVER_PORT,
  websocket: {
    close(socket) {
      const { clientId, room } = socket.data;

      room.sockets.delete(socket);
      removeAwarenessStates(room.awareness, [clientId], socket);

      if (room.sockets.size === 0) {
        scheduleIdleEviction(room);
      }
    },
    message(socket, message) {
      const { room } = socket.data;
      const frame = decodeTransportFrame(message);

      switch (frame.type) {
        case TRANSPORT_MESSAGE_TYPE.syncState:
        case TRANSPORT_MESSAGE_TYPE.yjsUpdate:
          applyUpdate(room.doc, frame.payload, socket);
          break;
        case TRANSPORT_MESSAGE_TYPE.awarenessUpdate:
          applyAwarenessUpdate(room.awareness, frame.payload, socket);
          break;
        default:
          break;
      }
    },
    open(socket) {
      const { room } = socket.data;

      clearIdleEviction(room);
      room.sockets.add(socket);
      sendSnapshot(socket, room);
    },
  },
});

console.log(
  `Pebbles collaboration server listening on ws://${server.hostname}:${server.port}`
);

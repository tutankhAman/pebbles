const ROOM_STORAGE_PREFIX = "pebbles:yjs-room:";

function getStorageKey(roomId: string) {
  return `${ROOM_STORAGE_PREFIX}${roomId}`;
}

function encodeUpdate(update: Uint8Array) {
  let encoded = "";

  for (const value of update) {
    encoded += String.fromCodePoint(value);
  }

  return btoa(encoded);
}

function decodeUpdate(encoded: string) {
  return Uint8Array.from(
    atob(encoded),
    (character) => character.codePointAt(0) ?? 0
  );
}

export function loadPersistedRoomState(roomId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const encoded = window.localStorage.getItem(getStorageKey(roomId));

    return encoded ? decodeUpdate(encoded) : null;
  } catch {
    return null;
  }
}

export function persistRoomState(roomId: string, update: Uint8Array) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getStorageKey(roomId), encodeUpdate(update));
  } catch {
    // Local persistence is a best-effort cache. Quota or privacy-mode failures
    // must not block live collaboration or remote room persistence.
  }
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIRECTORY = path.resolve(
  process.cwd(),
  process.env.COLLAB_SERVER_DATA_DIR ?? ".data/collab-rooms"
);

function getRoomFilePath(roomId) {
  return path.join(DATA_DIRECTORY, `${roomId}.bin`);
}

export async function loadPersistedRoomState(roomId) {
  try {
    const file = await readFile(getRoomFilePath(roomId));
    return new Uint8Array(file);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

export async function persistRoomState(roomId, update) {
  await mkdir(DATA_DIRECTORY, {
    recursive: true,
  });
  await writeFile(getRoomFilePath(roomId), Buffer.from(update));
}

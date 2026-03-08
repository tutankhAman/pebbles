import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  decodeTransportFrame,
  encodeTransportFrame,
  TRANSPORT_MESSAGE_TYPE,
} from "@/lib/yjs/transport-protocol";

describe("transport protocol", () => {
  test("encodes and decodes sync frames without copying the payload contract", () => {
    const payload = new Uint8Array([3, 5, 8, 13]);
    const frame = encodeTransportFrame(
      TRANSPORT_MESSAGE_TYPE.syncState,
      payload
    );
    const decoded = decodeTransportFrame(frame);

    assert.equal(decoded.type, TRANSPORT_MESSAGE_TYPE.syncState);
    assert.deepEqual(Array.from(decoded.payload), [3, 5, 8, 13]);
  });
});

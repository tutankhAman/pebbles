/**
 * Binary transport protocol for Yjs collaboration.
 * Must stay in sync with src/lib/yjs/transport-protocol.ts.
 *
 * Wire format: [1-byte message type] [payload bytes...]
 */

export const TRANSPORT_MESSAGE_TYPE = {
  awarenessUpdate: 2,
  syncState: 0,
  yjsUpdate: 1,
} as const;

export type TransportMessageType =
  (typeof TRANSPORT_MESSAGE_TYPE)[keyof typeof TRANSPORT_MESSAGE_TYPE];

export interface TransportFrame {
  payload: Uint8Array;
  type: TransportMessageType;
}

export function encodeTransportFrame(
  type: TransportMessageType,
  payload: Uint8Array
): Uint8Array {
  const frame = new Uint8Array(payload.length + 1);
  frame[0] = type;
  frame.set(payload, 1);
  return frame;
}

export function decodeTransportFrame(
  input: ArrayBuffer | Uint8Array
): TransportFrame {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  return {
    payload: bytes.subarray(1),
    type: bytes[0] as TransportMessageType,
  };
}

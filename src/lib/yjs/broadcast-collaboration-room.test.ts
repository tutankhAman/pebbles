import assert from "node:assert/strict";
import test from "node:test";
import { projectPeerPresence } from "@/lib/yjs/broadcast-collaboration-room";

test("projects peer presence by client id so same-user sessions remain visible", () => {
  const peers = projectPeerPresence({
    localClientId: 11,
    states: new Map<number, unknown>([
      [
        11,
        {
          activeCell: "A1",
          color: "#0f0",
          displayName: "Ada",
          userId: "user-1",
        },
      ],
      [
        12,
        {
          activeCell: "B2",
          color: "#0f0",
          displayName: "Ada",
          userId: "user-1",
        },
      ],
      [
        13,
        {
          color: "#00f",
          displayName: "Grace",
          selection: {
            end: "D4",
            start: "C3",
          },
          userId: "user-2",
        },
      ],
    ]),
  });

  assert.deepEqual(peers, [
    {
      activeCell: "B2",
      clientId: 12,
      color: "#0f0",
      displayName: "Ada",
      userId: "user-1",
    },
    {
      clientId: 13,
      color: "#00f",
      displayName: "Grace",
      selection: {
        end: "D4",
        start: "C3",
      },
      userId: "user-2",
    },
  ]);
});

test("ignores invalid awareness states while projecting peers", () => {
  const peers = projectPeerPresence({
    localClientId: 7,
    states: new Map<number, unknown>([
      [
        8,
        {
          color: "#0f0",
          displayName: "Ada",
          selection: {
            start: "A1",
          },
          userId: "user-1",
        },
      ],
      [9, null],
    ]),
  });

  assert.deepEqual(peers, []);
});

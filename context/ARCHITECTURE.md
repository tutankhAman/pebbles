# Architecture Specification

## Project

Lightweight real-time collaborative spreadsheet for the Trademarkia frontend engineering assignment.

## Goals

- Build a spreadsheet-like editor with a fast scrollable grid.
- Support real-time multi-session collaboration on the same document.
- Show active collaborators and visible write state.
- Keep the architecture simple enough to explain clearly in an interview.
- Support `1M` logical cells through sparse storage and viewport virtualization.
- Keep formula computation off the main UI thread.

## Non-Goals

- Snapshot blobs and object storage archival.
- Rich version history UI.
- Full spreadsheet product parity.
- Multi-sheet workbook support in the first submission unless time remains.
- Heavy backend orchestration outside what is required for auth, metadata, and collaboration.

## Technology Stack

| Layer | Choice | Responsibility |
| --- | --- | --- |
| App shell | Next.js App Router | Routing, server/client boundaries, Vercel deployment |
| Language | TypeScript strict mode | Type safety across UI, state, and worker boundaries |
| Styling | Tailwind CSS | UI styling and layout |
| Identity | Firebase Auth | Google sign-in and session identity bootstrap |
| Backend platform | Cloudflare Workers + Durable Objects | Single deployment for metadata, collaboration relay, and sheet persistence |
| Metadata store | MetadataStore Durable Object (SQLite) | Document list, title, owner, room id, last modified, user records |
| Live collaboration | Yjs + CollabDocument Durable Object | Live cell state, CRDT convergence, presence awareness, WebSocket relay |
| Durable content store | CollabDocument DO SQLite storage | Yjs document state persistence, cross-device restore |
| Worker routing | Hono | REST and WebSocket routing inside Cloudflare Worker |
| Yjs DO integration | y-durableobjects | Yjs sync protocol handling in Durable Objects |
| Formula engine | HyperFormula | Formula parsing, dependency tracking, computed values |
| Local UI state | React useState/useRef | Selection, editor mode, viewport, write-state status |
| Worker runtime | Web Worker | Isolated formula evaluation |

## High-Level Architecture

```text
Browser
 ├─ Next.js UI (deployed on Vercel)
 │   ├─ Dashboard
 │   ├─ Spreadsheet Editor
 │   ├─ Presence UI
 │   └─ Write-State Indicator
 ├─ Local UI State (useState/useRef)
 ├─ Yjs Document
 │   ├─ BroadcastChannel (same-browser sync, <5ms)
 │   └─ WebSocket transport (cross-device sync, ~50-100ms)
 ├─ HyperFormula Worker
 ├─ localStorage Yjs cache
 └─ Firebase Auth Client

Cloudflare Worker (single deployment)
 ├─ Hono Router
 │   ├─ REST endpoints -> MetadataStore DO
 │   └─ WebSocket upgrade -> CollabDocument DO
 ├─ MetadataStore Durable Object (global singleton)
 │   ├─ SQLite: documents table
 │   └─ SQLite: users table
 └─ CollabDocument Durable Object (one per document)
     ├─ In-memory Yjs Doc + Awareness
     ├─ WebSocket relay (binary Yjs updates)
     ├─ SQLite: persisted Yjs document state
     └─ WebSocket Hibernation (zero cost when idle)

External Services
 └─ Firebase Auth
```

## Source of Truth Rules

### Live state

- `Yjs` is the authoritative source of truth for:
  - cell values
  - formula source strings
  - runtime presence
  - collaborative convergence

### Metadata

- `MetadataStore` Durable Object SQLite is the authoritative source of truth for:
  - document id
  - title
  - owner / author
  - last modified
  - collaboration room identifier
  - user records

### Durable content persistence

- `CollabDocument` Durable Object SQLite stores persisted Yjs document state.
- This is the recovery source for:
  - restoring sheet contents after all clients disconnect
  - cross-device document recovery
  - cold-start room hydration
- Sheet contents are stored as encoded Yjs binary state, not as row-per-cell relational records.

### Local UI state

- React `useState`/`useRef` is authoritative only for ephemeral client state:
  - selected cell or range
  - editor open / closed state
  - viewport window
  - write-state indicator status

### Derived state

- `HyperFormula` in the worker produces derived computed values.
- Computed values are render outputs, not the primary user-authored source.
- Raw input remains authoritative so formulas can always be edited and recomputed.

## Repository Shape

```text
pebbles/
  src/
    app/
      layout.tsx
      page.tsx
      dashboard/
      documents/[documentId]/
    features/
      auth/
      dashboard/
      documents/
      spreadsheet/
      collaboration/
      formulas/
    lib/
      firebase/
      metadata/          # client-side metadata API calls
      yjs/               # BroadcastCollaborationRoom, transport protocol, persistence
      env/
    workers/
      formula.worker.ts
    types/
    providers/
  worker/                # Cloudflare Worker project
    src/
      index.ts           # Hono router entry point
      collab-document.ts # CollabDocument Durable Object
      metadata-store.ts  # MetadataStore Durable Object
    wrangler.toml
  context/               # Planning and architecture docs
```

## Runtime Components

## 1. Dashboard

### Responsibility

- List existing documents.
- Show title, last modified, and owner / author label.
- Create and open documents.

### Data source

- Reads and writes metadata via REST API calls to the Cloudflare Worker (`MetadataStore` DO).

### Notes

- The dashboard never reads full live sheet cell state.
- Opening a document fetches metadata first, then joins the matching Yjs room.

## 2. Spreadsheet Editor

### Responsibility

- Render the visible grid window.
- Support selection, editing, keyboard navigation, and presence display.
- Coordinate between Yjs updates, worker-computed values, and local UI state.

### Main subparts

- grid viewport
- cell renderer
- active editor overlay
- row and column headers
- presence indicators
- write-state indicator

## 3. Yjs Collaboration Layer

### Responsibility

- Maintain live shared document state.
- Merge concurrent edits through CRDT semantics.
- Broadcast presence through awareness.

### Document structure

```text
Y.Doc
 ├─ cells: Y.Map<string, CellRecord>
 └─ awareness: user presence state
```

### Cell key

- Canonical internal key format: `row:col`
- Example: `12:7`

### Cell record

```ts
type CellRecord = {
  raw: string
  kind: "text" | "number" | "formula"
  updatedAt?: number
  updatedBy?: string
}
```

Notes:

- `raw` stores the user-entered source, including formula strings like `=SUM(A1:A5)`.
- Computed values are not stored as the primary editable source in Yjs.
- `updatedAt` and `updatedBy` are optional and only used if collaboration UI benefits from them.

### Hybrid transport strategy

The collaboration layer uses a three-tier latency model:

| Tier | Transport | Latency | Scope |
| --- | --- | --- | --- |
| Local edit | Yjs local apply | `<1ms` | Immediate visual feedback |
| Same-browser | BroadcastChannel | `<5ms` | Multi-tab sync without network |
| Cross-device | CF DO WebSocket relay | `~50-100ms` same-region | Cross-browser, cross-device sync |

- Local Yjs edits always apply before any network round-trip.
- BroadcastChannel provides instant same-browser tab sync without touching the network.
- The Cloudflare DO WebSocket relay handles cross-device peers. The DO acts as both the relay and the durable persistence layer.
- Both transports coexist: same-browser tabs use BroadcastChannel AND the WebSocket transport simultaneously.

## 4. HyperFormula Worker

### Responsibility

- Parse and evaluate formulas.
- Track dependencies.
- Return computed values and formula errors without blocking the main thread.

### Worker message contract

```ts
type FormulaWorkerRequest =
  | { type: "bootstrap"; cells: Array<{ key: string; raw: string }> }
  | { type: "cell-upsert"; key: string; raw: string }
  | { type: "cell-delete"; key: string }
  | { type: "batch-upsert"; cells: Array<{ key: string; raw: string }> }
  | { type: "recompute-visible"; keys: string[] }

type FormulaWorkerResponse =
  | { type: "computed"; values: Array<{ key: string; value: string | number | boolean | null }> }
  | { type: "errors"; errors: Array<{ key: string; message: string }> }
  | { type: "ready" }
```

### Formula scope

- Required:
  - arithmetic expressions
  - direct cell references
  - ranges
  - `SUM`
- Allowed if trivial through HyperFormula:
  - `AVERAGE`
- Not required:
  - advanced financial, lookup, pivot, or scripting functions

## 5. Cloudflare Worker Backend

### Responsibility

- Single deployment handling all backend concerns:
  - document metadata CRUD
  - user record management
  - collaboration WebSocket relay
  - durable Yjs state persistence
  - presence/awareness relay

### Components

#### MetadataStore Durable Object

- Global singleton instance.
- Uses DO SQLite storage for documents and users tables.
- Serves REST API endpoints via Hono router.
- Handles: list documents, get document, create document, rename document, touch document, upsert user.

#### CollabDocument Durable Object

- One instance per document, identified by `roomId`.
- Maintains in-memory `Y.Doc` and `Awareness` for the active room.
- Handles WebSocket connections using the Hibernation API:
  - Idle rooms are evicted from memory while WebSocket connections stay alive.
  - On wake, constructor re-runs, state is restored from SQLite.
- Persists Yjs document state to DO SQLite on a debounced schedule.
- Relays binary Yjs updates and awareness messages between connected peers.
- Uses `locationHint` to spawn near the document creator's region.

### Why Cloudflare Durable Objects

- Per-document stateful isolation maps naturally to Yjs rooms.
- Co-located SQLite storage means microsecond reads and sub-millisecond writes.
- WebSocket Hibernation eliminates cost for idle documents.
- Single Worker deployment simplifies operations vs managing separate services.
- Honest tradeoff: ~50-100ms cross-device latency vs ~10-40ms on a direct VPS, but the demo scenario (two browser tabs) uses BroadcastChannel and is unaffected.

### Metadata model

```ts
type UserMeta = {
  id: string
  displayName: string
  email?: string
  color: string
}

type DocumentMeta = {
  id: string
  title: string
  ownerId: string
  ownerName: string
  roomId: string
  lastModifiedAt: number
  createdAt: number
}
```

## Data Flow Specifications

## Document open flow

```text
1. User opens dashboard
2. Client queries CF Worker MetadataStore for document list
3. User selects a document
4. Client resolves roomId from metadata
5. Client joins Yjs room:
   a. Hydrates from localStorage cache (instant)
   b. Connects BroadcastChannel (same-browser)
   c. Connects WebSocket to CF Worker CollabDocument DO (cross-device)
6. CollabDocument DO restores Yjs state from SQLite if cold start
7. Client bootstraps local sparse sheet view from Yjs state
8. Client sends sheet state to HyperFormula worker
9. Editor renders visible cells
```

## Cell edit flow

```text
1. User edits cell
2. UI writes raw cell content into local Yjs doc (<1ms)
3. Local write-state becomes Saving...
4. Local Yjs update is observed immediately
5. BroadcastChannel propagates to same-browser tabs (<5ms)
6. WebSocket sends binary Yjs update to CF CollabDocument DO
7. DO relays update to other connected peers (~50-100ms same-region)
8. DO persists Yjs state to SQLite (debounced)
9. Main thread sends changed cell to HyperFormula worker
10. Worker recomputes affected formulas
11. UI receives computed outputs
12. Write-state transitions to Saved
13. Metadata lastModifiedAt is updated asynchronously via MetadataStore DO
```

## Remote edit flow

```text
1. Remote peer writes to Yjs
2. Local client receives Yjs update (via BroadcastChannel or WebSocket)
3. Updated raw cell state is merged into local sheet view
4. Changed formula inputs are forwarded to HyperFormula worker
5. UI rerenders affected visible cells
6. Presence / write-state UI remains consistent
```

## Presence flow

```text
1. User joins document
2. Client publishes awareness state (name, color, cursor)
3. Awareness propagates via BroadcastChannel + WebSocket
4. Other clients receive active user metadata
5. Presence bar and selection indicators update
6. User disconnect or tab close clears awareness state
```

## Write-State Indicator Specification

### States

- `Idle`
- `Saving...`
- `Saved`
- `Reconnecting...`
- `Offline` optional

### Transition rules

- Move to `Saving...` when a local edit is written to Yjs and not yet considered settled.
- Move to `Saved` after local sync confirmation or a stable post-update state is observed.
- Move to `Reconnecting...` when collaboration transport drops.
- Move back to `Saved` after reconnection and state recovery succeed.

This indicator is UX-facing. It does not claim durable archival semantics.

## Spreadsheet Data Model

### Coordinate model

```ts
type CellAddress = {
  row: number
  col: number
}
```

### Key conversion

- Internal runtime key: `row:col`
- Display key: `A1`-style notation

### Sparse storage contract

- Only populated cells exist in shared state.
- Empty cells are virtual.
- Viewport queries materialize only the visible rectangle plus overscan.

### Logical bounds

- The editor supports at least `1M` logical cells.
- Default logical shape:
  - `10,000` rows x `100` columns

### Selection model

```ts
type Selection =
  | { type: "cell"; anchor: CellAddress }
  | { type: "range"; start: CellAddress; end: CellAddress }
```

## Rendering Model

### Viewport strategy

- Render only visible rows and columns plus overscan.
- Keep row and column headers pinned relative to the scroll container.
- DOM-based virtualization for assignment speed.

### Render responsibilities

- row labels
- column labels
- visible cells
- active selection
- collaborator indicators
- floating text editor overlay

### Performance requirements

- Avoid dense array allocation for the full sheet.
- Avoid rerendering non-visible cells.
- Limit recomputation fan-out on edit.
- Keep formula work off the main thread.

## Contention and Conflict Model

### Live collaboration

- Yjs provides CRDT-based convergence for same-document edits.
- The implementation does not require manual last-write-wins for cell content synchronization.

### Remaining UI-level edge cases

- Two users editing the same cell at once may still need UI messaging if final visible behavior is confusing.
- Presence indicators may lag briefly relative to content updates.
- Write-state is local UX state and may not perfectly describe remote visibility under degraded networks.

These tradeoffs should be described honestly in the README and demo.

## Authentication and Identity

### Auth modes

- Primary: Firebase Google sign-in
- Fallback: first-session display-name prompt for guest mode

### Identity payload used in collaboration UI

```ts
type SessionIdentity = {
  userId: string
  displayName: string
  color: string
}
```

### Requirements

- Identity must be available before joining the document room.
- Name and color must remain stable within the session.
- Presence UI uses this identity for active user display.

## Performance Targets

### Tiered latency model

| Tier | Target | Transport |
| --- | --- | --- |
| Local edit to screen | `<1ms` | Direct Yjs apply |
| Same-browser tab sync | `<5ms` | BroadcastChannel |
| Cross-device same-region | `~50-100ms` | CF DO WebSocket relay |
| Cross-device cross-region | Higher, documented honestly | CF DO WebSocket relay |

### Other targets

- `1M` logical cells supported through sparse storage
- Smooth visible-window scrolling during demo scenarios
- Same-browser collaboration keeps the `BroadcastChannel` fast path regardless of cross-device transport state

### Measurement plan

- measure initial document open time
- measure local edit to remote visible update time across two tabs (BroadcastChannel)
- measure local edit to remote visible update time across two devices (CF DO relay)
- measure visible-window rerender cost
- measure formula recompute time for small dependency chains
- measure cross-device restore time from DO SQLite persistence

### Likely hot paths

- viewport calculations
- visible-cell rerender boundaries
- Yjs update fan-out into UI state
- worker recomputation batching
- WebSocket message size and batching
- DO wake-from-hibernation cost

## Deployment Model

### Frontend

- Deploy to Vercel

### Backend

- Deploy Cloudflare Worker with `wrangler deploy`
- Single Worker handles REST + WebSocket endpoints
- Durable Objects handle per-document state and global metadata

### Runtime requirements

- Firebase environment variables (client-side)
- `NEXT_PUBLIC_API_URL` pointing to the Cloudflare Worker (used for both REST and WebSocket)

### Build requirements

- `tsc` passes without ignored errors
- production build passes
- no deploy-time type suppression shortcuts

## Testing Strategy

### Unit tests

- address conversion
- sparse storage helpers
- formula worker protocol adapters
- write-state transition logic
- transport protocol encoding/decoding

### Integration tests

- dashboard document creation
- editor cell editing
- formula recomputation
- two-tab collaboration
- presence rendering

### Manual demo checklist

- create document
- open same document in two tabs
- edit a cell in one tab and observe sync in the other
- show presence identities
- show write-state transitions
- show `SUM` and a basic arithmetic formula

## Interview Summary

The core design choice is deliberate:

- `Yjs` handles live collaborative state because it solves contention cleanly through CRDT convergence.
- `Cloudflare Durable Objects` provide the single consolidated backend: metadata storage, collaboration WebSocket relay, and durable Yjs document persistence, all in one deployment.
- The hybrid transport strategy uses `BroadcastChannel` for `<5ms` same-browser sync and CF DO WebSocket relay for `~50-100ms` cross-device sync, with local edits always applying instantly regardless of network state.
- `HyperFormula` runs in a worker because formulas should not compete with rendering and interaction.
- Local UI state uses React primitives (`useState`/`useRef`) to keep ownership boundaries clear.
- The architecture is honestly documented: cross-device latency is higher than a direct VPS WebSocket (~50-100ms vs ~10-40ms), but the tradeoff buys simpler operations, zero idle cost, and co-located persistence.

This gives a submission that is technically credible, performant enough for the assignment, and easy to defend under architectural questioning.

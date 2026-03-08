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
| App shell | Next.js App Router | Routing, server/client boundaries, deployment |
| Language | TypeScript strict mode | Type safety across UI, state, and worker boundaries |
| Styling | Tailwind CSS | UI styling and layout |
| Identity | Firebase Auth | Google sign-in and session identity bootstrap |
| Metadata store | InstantDB (current) | Early-phase document list, title, owner, room id, last modified, access metadata |
| Live collaboration | Yjs | Live cell state, CRDT convergence, presence awareness |
| Durable content store | Chunked Yjs persistence backend (target) | Saved sheet contents, cross-device restore, large-sheet chunk storage |
| Metadata + chunk registry | Consolidated backend (target) | Final metadata ownership, access control, chunk registry, room lookup |
| Formula engine | HyperFormula | Formula parsing, dependency tracking, computed values |
| Local UI state | Zustand | Selection, editor mode, viewport, write-state status |
| Worker runtime | Web Worker | Isolated formula evaluation |

## High-Level Architecture

```text
Browser
 ├─ Next.js UI
 │   ├─ Dashboard
 │   ├─ Spreadsheet Editor
 │   ├─ Presence UI
 │   └─ Write-State Indicator
 ├─ Zustand UI Store
 ├─ Yjs Document + Provider
 ├─ HyperFormula Worker
 └─ Firebase Auth Client

Backend Services - current implementation
 ├─ Firebase Auth
 └─ InstantDB
     ├─ users
     ├─ documents
     └─ access / membership metadata

Backend Services - target scalable architecture
 ├─ Firebase Auth
 ├─ Consolidated metadata + chunk registry backend
 └─ Durable Yjs persistence backend
     ├─ room lookup
     ├─ chunk registry
     └─ chunked Yjs document persistence
```

## Source of Truth Rules

### Live state

- `Yjs` is the authoritative source of truth for:
  - cell values
  - formula source strings
  - runtime presence
  - collaborative convergence

### Metadata

- `InstantDB` is the authoritative source of truth for:
  - document id
  - title
  - owner / author
  - last modified
  - collaboration room identifier
  - optional access records
- In the target architecture, this metadata ownership migrates behind a repository boundary to the consolidated backend.

### Durable content persistence

- The final scalable backend stores saved sheet contents as Yjs-compatible persisted state.
- For very large dense sheets, persisted state should be partitioned into chunks rather than stored as one giant document blob.
- The durable content store is responsible for:
  - restoring sheet contents after all clients disconnect
  - cross-device document recovery
  - chunk lookup for large-sheet working sets
- `InstantDB` is not intended to store live cell contents or chunk payloads in the target architecture.

### Local UI state

- `Zustand` is authoritative only for ephemeral client state:
  - selected cell or range
  - editor open / closed state
  - viewport window
  - write-state indicator status
  - transient performance counters for debug UI if needed

### Derived state

- `HyperFormula` in the worker produces derived computed values.
- Computed values are render outputs, not the primary user-authored source.
- Raw input remains authoritative so formulas can always be edited and recomputed.

## Repository Shape

The project should stay lean unless implementation complexity justifies internal modules.

```text
apps/
  web/
    app/
    components/
    features/
      auth/
      dashboard/
      spreadsheet/
      collaboration/
      formulas/
    lib/
      firebase/
      instantdb/
      yjs/
      worker/
    workers/
      formula.worker.ts
    stores/
      ui-store.ts
    types/
```

If feature growth demands stronger boundaries, extract local packages later, not at the start.

## Runtime Components

## 1. Dashboard

### Responsibility

- List existing documents.
- Show title, last modified, and owner / author label.
- Create and open documents.

### Data source

- Reads and writes metadata from `InstantDB`.

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

### Planned structure

```text
Y.Doc
 ├─ cells: Y.Map<string, CellRecord>
 ├─ meta: Y.Map<string, string | number | boolean>
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

## 5. InstantDB Metadata Layer

### Responsibility

- Store document discovery and dashboard metadata.
- Provide a stable mapping from document id to collaboration room id.
- Track update time for dashboard sorting and display.
- Serve as the early-phase metadata layer before later backend consolidation.

### Suggested metadata model

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

Optional access model:

```ts
type DocumentAccess = {
  id: string
  documentId: string
  userId: string
  role: "owner" | "editor" | "viewer"
}
```

## 6. Target Consolidated Backend

### Responsibility

- Replace long-term `InstantDB` dependency without breaking established editor contracts.
- Own final metadata, access control, room lookup, and chunk registry concerns.
- Coordinate with the durable Yjs persistence backend for sheet-content restore.

### Target data ownership

```ts
type DocumentMetaRecord = {
  id: string
  title: string
  ownerId: string
  ownerName: string
  roomId: string
  lastModifiedAt: number
  createdAt: number
  chunkLayoutVersion: number
}

type DocumentAccessRecord = {
  id: string
  documentId: string
  userId: string
  role: "owner" | "editor" | "viewer"
}

type SheetChunkRecord = {
  id: string
  documentId: string
  chunkId: string
  persistedStateRef: string
  updatedAt: number
}
```

### Notes

- The consolidated backend should not store sheet contents as row-per-cell relational records.
- It should track which chunks exist and where their durable Yjs-compatible state lives.
- This keeps metadata queries cheap while preserving a scalable path for dense sheets.

## Data Flow Specifications

## Document open flow

```text
1. User opens dashboard
2. Client queries InstantDB document metadata
3. User selects a document
4. Client resolves roomId from metadata
5. Client joins Yjs room
6. Client bootstraps local sparse sheet view from Yjs state
7. Client sends sheet state to HyperFormula worker
8. Editor renders visible cells
```

## Cell edit flow

```text
1. User edits cell
2. UI writes raw cell content into Yjs
3. Local write-state becomes Saving...
4. Local Yjs update is observed immediately
5. Main thread sends changed cell to HyperFormula worker
6. Worker recomputes affected formulas
7. UI receives computed outputs
8. Remote peers receive Yjs update
9. Write-state transitions to Saved when local sync is considered landed
10. Metadata lastModifiedAt is updated asynchronously through the active repository implementation
```

## Remote edit flow

```text
1. Remote peer writes to Yjs
2. Local client receives Yjs update
3. Updated raw cell state is merged into local sheet view
4. Changed formula inputs are forwarded to HyperFormula worker
5. UI rerenders affected visible cells
6. Presence / write-state UI remains consistent
```

## Presence flow

```text
1. User joins document
2. Client publishes awareness state
3. Other clients receive active user metadata
4. Presence bar and optional selection indicators update
5. User disconnect or tab close clears awareness state
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
- Suggested default logical shape:
  - `10,000` rows x `100` columns
  - or another equivalent size so long as the product of rows and columns meets or exceeds `1,000,000`

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
- Prefer DOM-based virtualization first for assignment speed unless canvas becomes necessary.
- For dense large-sheet scaling, the persisted model can be chunked even if the initial rendered viewport remains a single editor surface.

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
- Fallback: first-session display-name prompt if a looser demo mode is desired

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

### Primary targets

- `1M` logical cells supported through sparse storage
- `<50ms` collaboration propagation under normal local-region conditions
- Smooth visible-window scrolling during demo scenarios
- Same-browser collaboration keeps the `BroadcastChannel` fast path even after cross-device transport is added
- Large dense sheets are persisted and restored through chunked Yjs-backed state rather than one monolithic document

### Measurement plan

- measure initial document open time
- measure local edit to remote visible update time across two tabs
- measure local edit to remote visible update time across two devices on the networked provider
- measure visible-window rerender cost
- measure formula recompute time for small dependency chains
- measure cross-device restore time from durable Yjs persistence

### Likely hot paths

- viewport calculations
- visible-cell rerender boundaries
- Yjs update fan-out into UI state
- worker recomputation batching
- provider message size and batching
- chunk hydrate and restore path

## Deployment Model

### Frontend

- Deploy to Vercel

### Runtime requirements

- Firebase environment variables
- InstantDB configuration
- Yjs provider configuration
- durable Yjs persistence backend configuration

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

## Open Implementation Decisions

- Which networked Yjs provider transport to use for cross-device collaboration
- Whether DOM virtualization is sufficient or canvas should be introduced
- Whether clipboard support lands in MVP or immediate post-MVP polish
- Whether `AVERAGE` is included if HyperFormula makes it essentially free
- When to execute the InstantDB migration relative to submission timing
- Which consolidated backend should own metadata and chunk registry after migration

## Interview Summary

The core design choice is deliberate:

- `Yjs` handles live collaborative state because it solves contention cleanly.
- `InstantDB` handles metadata in early phases because the dashboard and document discovery do not need CRDT complexity.
- The final scalable backend can remove the `InstantDB` dependency once metadata and chunk-registry responsibilities migrate behind stable repository boundaries.
- Durable sheet contents should live as chunked Yjs-compatible state, not as row-per-cell database writes.
- `HyperFormula` runs in a worker because formulas should not compete with rendering and interaction.
- `Zustand` stays limited to local UI state to keep ownership boundaries clear.

This gives a submission that is technically credible, performant enough for the assignment, and easy to defend under architectural questioning.

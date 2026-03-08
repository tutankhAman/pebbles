# Trademarkia Spreadsheet Assignment Plan

## Objective

Build a lightweight, real-time, collaborative spreadsheet in `Next.js App Router` with `TypeScript`, `Tailwind CSS`, `Yjs`, `Cloudflare Durable Objects`, and `Firebase Auth`.

This plan is intentionally assignment-focused:

- [x] Include every must-have from the prompt.
- [x] Keep the implementation explainable in an interview.
- [x] Preserve ambitious performance targets where they matter.
- [x] Strip out heavyweight product work that does not improve the submission.

## Non-Negotiable Targets

- [x] Build passes with zero ignored TypeScript errors.
- [ ] Deploy cleanly on Vercel (frontend) and Cloudflare Workers (backend).
- [x] Real-time sync works across multiple open sessions of the same document.
- [x] Presence is visible in the editor.
- [x] Write-state indicator clearly shows whether changes have landed.
- [x] Support `1M` logical cells through sparse storage and viewport virtualization.
- [x] Target `<5ms` same-browser collaboration via `BroadcastChannel` and `~50-100ms` cross-device collaboration via Cloudflare DO WebSocket relay under normal same-region conditions.

## Chosen Architecture

### Stack

- [x] `Next.js` App Router
- [x] `TypeScript` in strict mode
- [x] `Tailwind CSS`
- [x] `Firebase Auth` for Google sign-in or first-session identity bootstrap
- [x] `Yjs` for live document state and presence
- [x] `Cloudflare Workers + Durable Objects` for backend: metadata store, collaboration relay, and durable Yjs persistence
- [x] `HyperFormula` for spreadsheet formula evaluation
- [x] `Hono` for Cloudflare Worker routing
- [x] `y-durableobjects` for Yjs protocol handling in Durable Objects

### Why this backend shape

- [x] Use `Yjs` for live collaboration so same-document contention is handled through CRDT convergence.
- [x] Use `Firebase Auth` because the assignment explicitly allows Firebase or equivalent and Google sign-in is a good fit.
- [x] Use `Cloudflare Durable Objects` as the single consolidated backend for metadata, collaboration relay, and sheet persistence.
- [x] Use `HyperFormula` instead of writing a custom formula engine for the assignment.
- [x] Do not introduce separate snapshot/versioning/object-storage infrastructure for the first submission.
- [x] Optimize for correctness, latency, and clarity over long-term archival complexity.
- [x] Keep collaboration local-first so edits land in the local Yjs document before any network acknowledgement.
- [x] Use a hybrid Yjs transport strategy with explicit latency tiers:
  - [x] `BroadcastChannel` for same-browser multi-tab propagation (`<5ms`)
  - [x] Cloudflare DO WebSocket relay for cross-device propagation (`~50-100ms` same-region)
  - [x] Local Yjs edits always apply immediately regardless of network state (`<1ms`)
- [x] Persist sheet contents as durable Yjs document state in DO SQLite storage rather than mirroring live cells into a relational database.
- [x] Use a single Cloudflare Worker deployment for both REST (metadata) and WebSocket (collaboration) endpoints.
- [x] Use WebSocket Hibernation API so idle collaboration rooms cost nothing.

### Why Cloudflare Durable Objects

- [x] Per-document stateful isolation: each document maps to one DO instance with its own in-memory Yjs doc and co-located SQLite storage.
- [x] WebSocket Hibernation API: idle rooms are evicted from memory while WebSocket connections stay alive, eliminating cost for inactive documents.
- [x] Co-located SQLite persistence: reads are same-thread microsecond operations, writes are synchronous from the application perspective.
- [x] Single deployment handles all backend concerns: metadata CRUD, collaboration relay, awareness/presence, and durable persistence.
- [x] Honest latency tradeoff: cross-device relay adds ~50-100ms vs a direct VPS WebSocket, but the architecture is simpler, cheaper, and the demo scenario (two browser tabs) uses BroadcastChannel which is unaffected.

### Source of Truth Rules

- [x] `Yjs` is the source of truth for live document cells and collaborator presence.
- [x] `CollabDocument` Durable Object SQLite storage is the recovery source for saved sheet contents after all clients disconnect.
- [x] `MetadataStore` Durable Object SQLite storage is the source of truth for metadata:
  - [x] users
  - [x] documents
  - [x] last modified
  - [x] owner / author
  - [x] access records
  - [x] collaboration room identifier
- [x] React `useState`/`useRef` stores ephemeral UI state only:
  - [x] current selection
  - [x] editor mode
  - [x] viewport
  - [x] pending write status
- [x] `HyperFormula` computes derived values in a dedicated worker and sends computed results back to the UI layer.
- [x] Raw cell input remains the authoritative user-authored value; computed display values are derived.
- [x] Remote transport and durable persistence must never force the editor to wait before applying a local edit.

### Collaboration Transport Strategy

- [x] Apply cell edits to the local `Yjs` document immediately.
- [x] Fan out local changes through the fastest available path:
  - [x] `BroadcastChannel` for same-browser tabs (`<5ms`)
  - [x] Cloudflare DO WebSocket relay for cross-device peers (`~50-100ms` same-region)
- [x] Keep Yjs updates in binary form over the network rather than translating live edits into JSON mutation payloads.
- [x] Use Cloudflare Durable Objects with `locationHint` for region-close WebSocket relay.
- [x] Throttle noisy presence updates so cursor and selection traffic does not compete with cell edits.
- [x] Batch remote formula recomputations so worker traffic scales with changed cells rather than packet count.
- [x] Persist durable Yjs state asynchronously in DO SQLite so network or storage latency does not slow typing.

### Local-First Persistence Rules

- [x] Treat the browser-resident `Yjs` document as the immediate collaboration runtime.
- [x] Treat backend persistence as a durability concern, not a prerequisite for rendering or collaboration.
- [x] Never wait for backend acknowledgement before:
  - [x] showing a typed value
  - [x] updating local selection state
  - [x] broadcasting a collaborative update to peers
- [x] Persist durable state on a debounced or batched schedule rather than per keystroke.
- [x] Persist Yjs-compatible binary state rather than row-per-cell CRUD writes.
- [x] Keep metadata updates such as `lastModified` off the hot edit path:
  - [x] debounce them
  - [x] coalesce repeated edits into a single metadata update where possible
- [x] Define separate guarantees for:
  - [x] local visible edit latency (`<1ms`)
  - [x] same-browser collaboration latency (`<5ms` via BroadcastChannel)
  - [x] cross-device collaboration latency (`~50-100ms` via CF DO relay)
  - [x] durable persistence lag (debounced, async)
- [x] Accept short durability lag in exchange for a faster editor, but document the window honestly.
- [x] Recover unsaved-in-flight state through local Yjs/session persistence when possible if the backend flush has not landed yet.

### Worker and Main-Thread Boundaries

- [x] Keep the main thread responsible only for:
  - [x] visible-window rendering
  - [x] selection and editor interaction
  - [x] lightweight Yjs event application
- [x] Move heavy or bursty work away from the main thread:
  - [x] formula parsing and recomputation
  - [x] large import/export transforms
  - [x] expensive snapshot/chunk serialization if it becomes measurable
- [x] Avoid full-document serialization on the main thread during active editing.
- [x] Ensure background persistence work never blocks scroll, typing, or cursor movement.

## Must-Haves From the Assignment

- [x] Dashboard lists documents with:
  - [x] title
  - [x] last modified
  - [x] author / owner identity label
- [x] Editor includes:
  - [x] scrollable grid
  - [x] numbered rows
  - [x] lettered columns
  - [x] editable cells
- [x] Formula support includes at minimum:
  - [x] basic arithmetic
  - [x] cell references
  - [x] `=SUM(...)`
- [x] Realtime sync across multiple sessions of the same document.
- [x] Presence UI showing active collaborators.
- [x] Identity flow:
  - [x] first-time user sets display name or signs in with Google
  - [x] name sticks for the session
  - [x] user color sticks for the session
- [x] Write-state indicator:
  - [x] local edit pending
  - [x] synced / landed
  - [x] reconnecting or degraded state if applicable
- [ ] Vercel-ready build with no ignored TypeScript errors.
- [ ] Private GitHub repo, deploy URL, and demo video prepared for submission.

## Explicit Non-Goals For This Submission

- [x] Snapshot blobs and object storage archival.
- [x] Rich version history UI.
- [x] Full Excel formula coverage.
- [x] Pivot tables, charts, macros, or import pipelines.
- [x] Multi-sheet workbooks unless time remains after all must-haves are solid.

## Bonus Scope

- [ ] Cell formatting
- [ ] Row and column resize
- [x] Keyboard navigation polish
- [ ] Reorder rows or columns by drag
- [ ] Export support

---

## Phase 0 - Assignment Framing and Repo Setup

### Goals

- [x] Lock scope before building.
- [x] Make build quality and submission requirements visible from day one.

### Checklist

- [x] Create repo structure for a single Next.js app with internal feature folders or lightweight packages only if needed.
- [x] Configure:
  - [x] strict TypeScript
  - [x] Biome
  - [x] Tailwind CSS
- [x] Add CI or local scripts for:
  - [x] typecheck
  - [x] lint
  - [x] build
- [x] Create a short architecture note that explains:
  - [x] why `Yjs` is used for live collaboration
  - [x] why `Cloudflare Durable Objects` are used for the backend
  - [x] why Firebase Auth is used for identity
  - [x] why HyperFormula is used for formulas
  - [x] why formula evaluation runs in a separate worker
  - [x] how contention is handled
  - [x] what formula scope is intentionally limited
  - [x] what is deliberately out of scope
- [x] Create a minimal README scaffold with sections for:
  - [x] setup
  - [x] architecture
  - [x] tradeoffs
  - [x] demo instructions
  - [x] submission checklist

### Exit Criteria

- [x] App boots locally.
- [x] Typecheck, lint, and build scripts exist.
- [x] Scope and tradeoffs are documented before feature work starts.

---

## Phase 1 - Auth, Identity, and Document Dashboard

### Goals

- [x] Ship the required home screen and user identity flow first.

### Checklist

- [x] Set up Firebase Auth with Google sign-in.
- [x] Add first-time identity fallback:
  - [x] prompt for display name if not signed in
  - [x] assign deterministic session color
- [x] Persist session identity needed for collaboration presence.
- [x] Define document metadata shape for:
  - [x] users
  - [x] documents
  - [x] document membership or access records if needed
  - [x] document metadata
- [x] Define metadata fields:
  - [x] title
  - [x] last modified timestamp
  - [x] author / owner
  - [x] collaboration room identifier
- [x] Implement dashboard view showing:
  - [x] document title
  - [x] last modified timestamp
  - [x] author / owner
- [x] Implement create document action.
- [x] Implement open existing document action.
- [x] Implement update of `last modified` when document content changes.
- [x] Make dashboard responsive and clean enough for demo use.

### Exit Criteria

- [x] New user can set identity or sign in.
- [x] User can create and open documents.
- [x] Dashboard visibly satisfies the assignment requirement.

---

## Phase 2 - Spreadsheet Data Model and 1M-Cell Strategy

### Goals

- [x] Design the sheet model around sparse storage and cheap viewport reads.
- [x] Support large logical grids without allocating large matrices.

### Checklist

- [x] Define core types:
  - [x] `CellAddress`
  - [x] `CellContent`
  - [x] `FormulaInput`
  - [x] `ComputedValue`
  - [x] `Selection`
  - [x] `Viewport`
- [x] Choose internal cell key format:
  - [x] row and column coordinates as canonical internal form
  - [x] `A1` helpers for display and parsing
- [x] Implement sparse storage:
  - [x] only non-empty cells are stored
  - [x] empty cells are derived implicitly
- [x] Define logical sheet bounds that allow `1M` addressable cells.
- [x] Add chunk/window helpers for viewport access.
- [x] Implement core operations:
  - [x] set cell
  - [x] clear cell
  - [x] read cell
  - [x] read rectangular range
  - [x] batch paste range
- [x] Add tests for:
  - [x] address conversions
  - [x] sparse reads and writes
  - [x] large logical grid access

### Exit Criteria

- [x] Data model supports `1M` logical cells without dense allocation.
- [x] Core cell operations are stable and test-covered.

---

## Phase 3 - Grid Rendering and Viewport Virtualization

### Goals

- [x] Render a fast, scrollable grid suitable for the assignment demo.
- [x] Only render what is visible plus a small buffer.

### Checklist

- [x] Implement spreadsheet viewport model:
  - [x] scroll position
  - [x] visible row range
  - [x] visible column range
  - [x] overscan buffer
- [x] Render:
  - [x] column headers with letters
  - [x] row headers with numbers
  - [x] visible cell window
- [x] Ensure editor grid scrolls smoothly on large logical sheets.
- [x] Map pointer coordinates to cell coordinates.
- [x] Implement active-cell and selection visuals.
- [x] Avoid rendering the full logical grid.
- [x] Measure:
  - [x] scroll smoothness
  - [x] visible window computation cost
  - [x] cost of selection updates

### Exit Criteria

- [x] Grid is scrollable and usable.
- [x] Rendering strategy clearly supports large logical sheets.
- [x] Demoing large-sheet scrolling is plausible without visible collapse.

---

## Phase 4 - Editing, Navigation, and Write-State Indicator

### Goals

- [x] Make editing feel spreadsheet-like.
- [x] Expose sync state clearly to the user.

### Checklist

- [x] Implement editable cell interaction:
  - [x] click to select
  - [x] double click or direct typing to edit
  - [x] commit on enter / blur
- [x] Implement keyboard navigation:
  - [x] arrow keys
  - [x] tab
  - [x] enter
  - [x] escape
- [x] Implement rectangular selection.
- [x] Implement copy and paste for rectangular cell data if time allows inside core scope.
- [x] Add write-state indicator states:
  - [x] `Saving...`
  - [x] `Saved`
  - [x] `Reconnecting...`
  - [x] optional `Offline`
- [x] Define when state transitions occur:
  - [x] local edit queued
  - [x] server ack or subscription confirmation received
  - [x] connection lost
  - [x] connection restored
- [x] Add tests for:
  - [x] keyboard movement
  - [x] edit commit behavior
  - [x] write-state transitions

### Exit Criteria

- [x] Editing works reliably.
- [x] Navigation behaves as expected for core keys.
- [x] Write-state indicator is visible and understandable.

---

## Phase 5 - Formula Engine Scope

### Goals

- [x] Integrate `HyperFormula` for the minimum formula scope required by the prompt.
- [x] Run formula evaluation in a dedicated worker so editing and scrolling stay responsive.
- [x] Keep supported function scope intentionally narrow and defensible.

### Checklist

- [x] Support raw values:
  - [x] text
  - [x] number
- [x] Detect formula inputs by leading `=`.
- [x] Set up a dedicated formula worker.
- [x] Initialize `HyperFormula` inside the worker.
- [x] Define worker message protocol for:
  - [x] sheet bootstrap
  - [x] cell edit updates
  - [x] recompute requests
  - [x] computed value responses
  - [x] formula error responses
- [x] Map sheet cell coordinates to `HyperFormula` references.
- [x] Support formula scope through `HyperFormula`:
  - [x] basic arithmetic like `=A1+B1`
  - [x] direct cell references
  - [x] `SUM` over comma args or ranges
- [x] Support ranges such as `A1:A5`.
- [x] Recompute dependent cells on edit through the worker.
- [x] Handle formula errors safely:
  - [x] invalid reference
  - [x] malformed expression
  - [x] circular dependency basic guard
- [ ] Document the formula tradeoff in README:
  - [ ] why `HyperFormula` was chosen instead of a custom parser
  - [ ] why supported formula scope is intentionally limited for the assignment
  - [ ] why this is sufficient for the rubric

### Exit Criteria

- [x] `=SUM(...)` works.
- [x] Basic arithmetic across cell refs works.
- [x] Formula evaluation is isolated from the main UI thread.
- [ ] Formula scope is explicit and justified in README.

---

## Phase 6 - Realtime Collaboration and Presence

### Goals

- [x] Make multi-session editing correct and demoable.
- [x] Keep latency low and collaboration state visible.
- [x] Keep `Yjs` responsible for live sync.

### Checklist

- [x] Define `Yjs` document structure for:
  - [x] cells
  - [x] runtime sheet metadata needed during editing
- [x] Implement Yjs provider / room connection lifecycle.
- [x] Implement the low-latency local collaboration path first:
  - [x] same-browser propagation through `BroadcastChannel`
  - [x] refresh recovery from persisted local Yjs state
- [x] Bootstrap the correct collaboration room from document metadata.
- [x] Propagate cell edits across sessions through Yjs updates.
- [x] Define how local edits map to Yjs updates.
- [x] Define how remote Yjs updates map into rendered sheet state.
- [x] Ensure local edits are visible immediately before network acknowledgement.
- [x] Document contention behavior:
  - [x] CRDT-backed convergence through Yjs
  - [x] any remaining UI-level conflict edge cases
- [x] Implement presence state:
  - [x] active users in document
  - [x] name
  - [x] color
  - [x] optional current selection or active cell
- [x] Use Yjs awareness for presence updates.
- [x] Show active collaborators in the UI.
- [x] Ensure identity is attached to presence consistently.
- [x] Add instrumentation or lightweight timing logs for:
  - [x] local edit to remote visible update
  - [x] reconnect timing
- [x] Validate target behavior with two-tab testing.

### Exit Criteria

- [x] Two sessions stay in sync.
- [x] Presence is visible and stable.
- [x] Collaboration behavior is CRDT-based, correct, and documented.
- [x] Local same-browser collaboration path is low-latency and robust enough to build on for cross-device sync.

---

## Phase 6B - Cross-Device Collaboration and Durable Yjs Persistence

### Goals

- [x] Extend collaboration from local multi-tab to cross-device, cross-browser sessions.
- [x] Keep local edits instant while minimizing cross-device propagation latency.
- [x] Add durable Yjs-backed sheet persistence.

### Checklist

- [x] Introduce a networked Yjs provider abstraction that can coexist with the local `BroadcastChannel` fast path.
- [x] Choose a cross-device transport optimized for low latency:
  - [x] WebSocket-based Yjs provider
  - [x] long-lived connection model suitable for frequent small updates
- [x] Keep the editor transport-agnostic so same-browser and cross-device peers share the same Yjs room API.
- [x] Ensure same-browser tabs still short-circuit through `BroadcastChannel` even when the networked provider is connected.
- [x] Persist durable Yjs room state outside the browser so sheet contents survive:
  - [x] full browser close
  - [x] device switch
  - [x] all clients disconnecting
- [x] Keep persistence asynchronous relative to editing:
  - [x] local cell edits mutate local `Yjs` first
  - [x] remote peers receive provider updates before durable storage acknowledgement is required
  - [x] durable writes happen on a debounced flush schedule
- [x] Store durable sheet content as encoded Yjs document state.
- [x] Optimize remote propagation path:
  - [x] binary Yjs updates over the wire
  - [x] no per-cell REST or JSON write amplification
  - [x] coalesced presence traffic
  - [x] bounded reconnection backoff
  - [x] no synchronous persistence calls in the local edit path

### Exit Criteria

- [x] A document edited on one device appears on another device through the networked Yjs provider.
- [x] Reloading from a different device restores the latest durable sheet contents.
- [x] Same-browser collaboration remains fast after adding cross-device transport.

---

## Phase 6C - Backend Consolidation: Cloudflare Durable Objects

### Goals

- [ ] Replace the standalone Bun collaboration server and file-based metadata store with a single Cloudflare Worker deployment.
- [ ] Use Cloudflare Durable Objects as the unified backend for both document metadata and durable Yjs sheet persistence.
- [ ] Remove `InstantDB` and all file-based storage dependencies.
- [ ] Keep the hybrid collaboration transport intact:
  - [ ] `BroadcastChannel` for same-browser tab sync (`<5ms`)
  - [ ] Cloudflare DO WebSocket relay for cross-device sync (`~50-100ms` same-region)
  - [ ] Local Yjs edits always apply immediately regardless of network state (`<1ms`)

### Architecture

- [ ] A single Cloudflare Worker serves both REST (metadata) and WebSocket (collaboration) endpoints.
- [ ] Two Durable Object classes:
  - [ ] `CollabDocument`: one instance per document, handles Yjs sync protocol, awareness/presence relay, and persists Yjs state to DO SQLite storage.
  - [ ] `MetadataStore`: single global instance, handles document CRUD, user records, stored in DO SQLite.
- [ ] Use `y-durableobjects` with Hono for routing and Yjs protocol handling.
- [ ] Use WebSocket Hibernation API so idle rooms cost nothing.

### Checklist

- [ ] Set up Cloudflare Worker project at `worker/` with `wrangler.toml`.
- [ ] Install dependencies: `y-durableobjects`, `hono`, `wrangler` (dev), `yjs`, `y-protocols`.
- [ ] Implement `CollabDocument` Durable Object:
  - [ ] WebSocket upgrade and connection lifecycle via Hibernation API.
  - [ ] Yjs sync protocol: `syncState`, `yjsUpdate`, `awarenessUpdate` message handling.
  - [ ] Persist Yjs document state to DO SQLite storage on debounced schedule.
  - [ ] Restore Yjs state from SQLite on room wake / cold start.
  - [ ] Broadcast updates to all connected peers (exclude sender).
  - [ ] Clean up awareness state on client disconnect.
  - [ ] Use `locationHint` to spawn DOs near initial creator's region.
- [ ] Implement `MetadataStore` Durable Object:
  - [ ] SQLite schema for documents and users.
  - [ ] REST endpoints: list documents, get document, create document, rename document, touch document, upsert user.
  - [ ] Return document metadata including `roomId` for collaboration room lookup.
- [ ] Set up Hono router in Worker entry point:
  - [ ] `GET/POST /api/documents` -> MetadataStore DO
  - [ ] `GET/PATCH /api/documents/:id` -> MetadataStore DO
  - [ ] `POST /api/users` -> MetadataStore DO
  - [ ] `GET /ws/rooms/:roomId` -> CollabDocument DO (WebSocket upgrade)
- [ ] Add CORS headers for REST endpoints (allow Vercel origin and localhost).
- [ ] Update Next.js client `metadata-store.ts`:
  - [ ] Point all metadata API calls at the Cloudflare Worker URL instead of local `/api/metadata/` routes.
  - [ ] Pass Cloudflare Worker base URL via `NEXT_PUBLIC_API_URL` env var.
- [ ] Update Next.js client `broadcast-collaboration-room.ts`:
  - [ ] Point WebSocket transport at Cloudflare Worker URL (`NEXT_PUBLIC_API_URL` + `/ws/rooms/:roomId`).
  - [ ] Keep `BroadcastChannel` fast path unchanged.
  - [ ] Keep local `localStorage` Yjs persistence unchanged as client-side cache.
- [ ] Remove dead code:
  - [ ] Delete `server/collab/collaboration-server.mjs` and `server/collab/room-persistence.mjs`.
  - [ ] Delete `src/lib/instantdb/client.ts`.
  - [ ] Delete `src/lib/instantdb/server-metadata-store.ts`.
  - [ ] Delete `src/app/api/metadata/` routes.
  - [ ] Remove `@instantdb/react` from `package.json`.
- [ ] Rename `src/lib/instantdb/` directory to `src/lib/metadata/` to reflect actual purpose.
- [ ] Update `.env.example` with new env vars:
  - [ ] `NEXT_PUBLIC_API_URL` (Cloudflare Worker URL, used for both REST and WebSocket)
  - [ ] Remove `NEXT_PUBLIC_COLLAB_WS_URL` (now derived from `NEXT_PUBLIC_API_URL`)
  - [ ] Remove `COLLAB_SERVER_HOST`, `COLLAB_SERVER_PORT`, `COLLAB_SERVER_DATA_DIR`
  - [ ] Remove `NEXT_PUBLIC_INSTANTDB_APP_ID`
- [ ] Test locally with `wrangler dev` + `next dev`.
- [ ] Deploy Worker with `wrangler deploy`.
- [ ] Validate:
  - [ ] Dashboard loads documents from CF Worker.
  - [ ] Creating a document writes to CF Worker MetadataStore.
  - [ ] Opening a document connects WebSocket to CF Worker CollabDocument.
  - [ ] Two-tab BroadcastChannel sync still works at `<5ms`.
  - [ ] Cross-browser sync works through CF Worker WebSocket relay.
  - [ ] Presence (name, color, cursor) propagates correctly.
  - [ ] Reloading restores sheet state from DO SQLite persistence.
  - [ ] Write-state indicator transitions correctly.

### Exit Criteria

- [ ] No standalone Bun server process required.
- [ ] No `InstantDB` dependency in code or `package.json`.
- [ ] No file-based metadata or collaboration persistence.
- [ ] Single Cloudflare Worker deployment handles all backend concerns.
- [ ] Same-browser tab collaboration latency unchanged (`<5ms` via BroadcastChannel).
- [ ] Cross-device collaboration works through CF DO WebSocket relay.
- [ ] Sheet state persists durably in DO SQLite storage.
- [ ] Document metadata persists in DO SQLite storage.
- [ ] Local edits remain instant regardless of network state.

---

## Phase 7 - Performance Pass

### Goals

- [ ] Defend the `1M` logical cell goal and tiered collaboration latency targets with practical evidence.

### Checklist

- [ ] Create performance fixture documents:
  - [ ] sparse large grid
  - [ ] formula-heavy sample
  - [ ] multi-user edit sample
- [ ] Measure:
  - [ ] initial editor load time
  - [ ] scroll responsiveness on large logical sheets
  - [ ] edit-to-render latency (local, target `<1ms`)
  - [ ] same-browser collaboration propagation latency (target `<5ms` via BroadcastChannel)
  - [ ] cross-device collaboration propagation latency (target `~50-100ms` via CF DO relay)
  - [ ] rejoin and restore latency from DO SQLite persistence
  - [ ] durability flush lag during active typing bursts
- [ ] Optimize hot spots:
  - [ ] viewport calculation
  - [ ] rerender boundaries
  - [ ] subscription update fan-out
  - [ ] worker-based formula recalculation path
  - [ ] Yjs transport batching and provider message size
  - [ ] presence throttling under concurrent activity
  - [ ] persistence debounce window and flush cost
- [ ] Document real observed performance numbers.
- [ ] Document the tiered latency model honestly:
  - [ ] local edit: `<1ms`
  - [ ] same-browser BroadcastChannel: `<5ms`
  - [ ] cross-device CF DO relay: `~50-100ms` same-region
  - [ ] cross-region: higher, documented with real measurements

### Exit Criteria

- [ ] There is concrete evidence behind the performance claims.
- [ ] Large-sheet behavior is demoable.
- [ ] Collaboration latency story is measured, not guessed.
- [ ] Tiered latency model is documented with real numbers.

---

## Phase 8 - Bonus Features

### Goals

- [ ] Add only after all must-haves are stable, deployed, and documented.

### Checklist

- [ ] Row and column resize.
- [ ] Cell formatting:
  - [ ] bold
  - [ ] italic
  - [ ] color
- [ ] Stronger keyboard navigation polish.
- [ ] Reorder rows or columns by drag.
- [ ] Export support.

### Exit Criteria

- [ ] Bonus work does not destabilize core collaboration or deployment quality.

---

## Phase 9 - Submission Packaging

### Goals

- [ ] Ship the assignment in the exact format they asked for.

### Checklist

- [ ] Prepare private GitHub repo.
- [ ] Ensure commit history is incremental and readable.
- [ ] Grant access to `recruitments@trademarkia.com`.
- [ ] Deploy frontend to Vercel.
- [ ] Deploy backend to Cloudflare Workers.
- [ ] Verify production build has no TypeScript suppression-based failures.
- [ ] Record a `2-3` minute demo video showing:
  - [ ] dashboard
  - [ ] editor
  - [ ] two-tab live sync
  - [ ] presence
  - [ ] write-state indicator
  - [ ] short code walkthrough
- [ ] Finalize README with:
  - [ ] setup steps
  - [ ] architecture
  - [ ] realtime strategy
  - [ ] contention behavior
  - [ ] formula scope
  - [ ] tradeoffs
  - [ ] known limitations
- [ ] Submit:
  - [ ] GitHub repo link
  - [ ] deployed project link
  - [ ] form entry

### Exit Criteria

- [ ] The project is not just built; it is submission-ready.

---

## Evaluation Mapping

### Functionality

- [x] Dashboard works.
- [x] Editor works.
- [x] Formula support works.
- [x] Collaboration works.

### Architecture

- [ ] Server and client boundaries are easy to explain.
- [ ] Realtime data flow is simple.
- [ ] State ownership is clear.
- [ ] `Yjs` live state vs `Cloudflare DO` metadata/persistence split is easy to explain.

### Code Quality

- [x] Strict TypeScript is maintained.
- [x] Components are focused and not over-abstracted.
- [x] Tailwind usage stays readable.

### Realtime Behaviour

- [x] Concurrent edits converge predictably.
- [x] Presence works reliably.
- [x] Reconnect state is visible.
- [ ] Cross-device collaboration restores and converges correctly.

### Documentation

- [ ] README explains tradeoffs.
- [ ] Commit history tells a coherent story.
- [ ] Demo shows the important behaviors quickly.

## Final Build Order

1. [x] Repo setup, strict config, README scaffold
2. [x] Auth and identity
3. [x] Dashboard
4. [x] Sparse sheet model
5. [x] Virtualized editor grid
6. [x] Editing and write-state indicator
7. [x] Formula support
8. [x] Realtime sync and presence
8.5. [x] Cross-device collaboration transport and durable Yjs persistence
8.75. [ ] Backend consolidation: Cloudflare Durable Objects Worker
9. [ ] Performance pass
10. [ ] Bonus features only if stable
11. [ ] Submission packaging

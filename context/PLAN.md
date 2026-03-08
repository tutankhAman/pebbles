# Trademarkia Spreadsheet Assignment Plan

## Objective

Build a lightweight, real-time, collaborative spreadsheet in `Next.js App Router` with `TypeScript`, `Tailwind CSS`, `Yjs`, `InstantDB`, and `Firebase Auth`.

This plan is intentionally assignment-focused:

- [ ] Include every must-have from the prompt.
- [ ] Keep the implementation explainable in an interview.
- [ ] Preserve ambitious performance targets where they matter.
- [ ] Strip out heavyweight product work that does not improve the submission.

## Non-Negotiable Targets

- [ ] Build passes with zero ignored TypeScript errors.
- [ ] Deploy cleanly on Vercel.
- [ ] Real-time sync works across multiple open sessions of the same document.
- [ ] Presence is visible in the editor.
- [ ] Write-state indicator clearly shows whether changes have landed.
- [ ] Support `1M` logical cells through sparse storage and viewport virtualization.
- [ ] Target `<50ms` collaboration propagation under normal local-region conditions.

## Chosen Architecture

### Stack

- [ ] `Next.js` App Router
- [ ] `TypeScript` in strict mode
- [ ] `Tailwind CSS`
- [ ] `Firebase Auth` for Google sign-in or first-session identity bootstrap
- [ ] `Yjs` for live document state and presence
- [ ] `InstantDB` for metadata, document listings, and access records
- [ ] `HyperFormula` for spreadsheet formula evaluation
- [ ] `Zustand` for local UI state only

### Why this backend shape

- [ ] Use `Yjs` for live collaboration so same-document contention is handled through CRDT convergence.
- [ ] Use `Firebase Auth` because the assignment explicitly allows Firebase or equivalent and Google sign-in is a good fit.
- [ ] Use `InstantDB` for dashboard metadata and document lookup rather than live cell synchronization.
- [ ] Use `HyperFormula` instead of writing a custom formula engine for the assignment.
- [ ] Do not introduce separate snapshot/versioning/object-storage infrastructure for the first submission.
- [ ] Optimize for correctness, latency, and clarity over long-term archival complexity.
- [ ] Keep collaboration local-first so edits land in the local Yjs document before any network acknowledgement.
- [ ] Use a hybrid Yjs transport strategy:
  - [ ] `BroadcastChannel` for same-browser multi-tab propagation
  - [ ] a networked Yjs provider for cross-device propagation
- [ ] Keep `InstantDB` metadata-only even after cross-device sync is added.
- [ ] Persist sheet contents as durable Yjs document state rather than mirroring live cells into `InstantDB`.

### Target Backend Evolution

- [ ] Keep `InstantDB` only as the early delivery metadata layer for the already-completed phases.
- [ ] Move toward a consolidated backend shape once collaboration and persistence are proven:
  - [ ] one durable metadata store
  - [ ] one chunk registry for large-sheet partitioning
  - [ ] one durable Yjs persistence backend for sheet contents
- [ ] Preserve the application-level contract during migration so the editor, dashboard, and collaboration code do not need a rewrite.
- [ ] Treat `InstantDB` migration as a dedicated later phase rather than churning completed phases.
- [ ] For very large dense sheets, prefer chunked Yjs-backed persistence over a single monolithic document blob.

### Source of Truth Rules

- [ ] `Yjs` is the source of truth for live document cells and collaborator presence.
- [ ] A durable Yjs persistence layer is the recovery source for saved sheet contents after all clients disconnect.
- [ ] `InstantDB` is the source of truth for metadata:
  - [ ] users
  - [ ] documents
  - [ ] last modified
  - [ ] owner / author
  - [ ] access records
  - [ ] collaboration room identifier
- [ ] `Zustand` stores ephemeral UI state only:
  - [ ] current selection
  - [ ] editor mode
  - [ ] viewport
  - [ ] pending write status
- [ ] `HyperFormula` computes derived values in a dedicated worker and sends computed results back to the UI layer.
- [ ] Raw cell input remains the authoritative user-authored value; computed display values are derived.
- [ ] Remote transport and durable persistence must never force the editor to wait before applying a local edit.

### Collaboration Transport Strategy

- [ ] Apply cell edits to the local `Yjs` document immediately.
- [ ] Fan out local changes through the fastest available path:
  - [ ] `BroadcastChannel` for same-browser tabs
  - [ ] networked Yjs provider for cross-device peers
- [ ] Keep Yjs updates in binary form over the network rather than translating live edits into JSON mutation payloads.
- [ ] Prefer a region-close WebSocket transport for cross-device collaboration.
- [ ] Throttle noisy presence updates so cursor and selection traffic does not compete with cell edits.
- [ ] Batch remote formula recomputations so worker traffic scales with changed cells rather than packet count.
- [ ] Persist durable Yjs state asynchronously so network or storage latency does not slow typing.

### Local-First Persistence Rules

- [ ] Treat the browser-resident `Yjs` document as the immediate collaboration runtime.
- [ ] Treat backend persistence as a durability concern, not a prerequisite for rendering or collaboration.
- [ ] Never wait for backend acknowledgement before:
  - [ ] showing a typed value
  - [ ] updating local selection state
  - [ ] broadcasting a collaborative update to peers
- [ ] Persist durable state on a debounced or batched schedule rather than per keystroke.
- [ ] Persist Yjs-compatible binary state or chunk updates rather than row-per-cell CRUD writes.
- [ ] Keep metadata updates such as `lastModified` off the hot edit path:
  - [ ] debounce them
  - [ ] coalesce repeated edits into a single metadata update where possible
- [ ] Define separate guarantees for:
  - [ ] local visible edit latency
  - [ ] remote collaboration latency
  - [ ] durable persistence lag
- [ ] Accept short durability lag in exchange for a faster editor, but document the window honestly.
- [ ] Recover unsaved-in-flight state through local Yjs/session persistence when possible if the backend flush has not landed yet.

### Worker and Main-Thread Boundaries

- [ ] Keep the main thread responsible only for:
  - [ ] visible-window rendering
  - [ ] selection and editor interaction
  - [ ] lightweight Yjs event application
- [ ] Move heavy or bursty work away from the main thread:
  - [ ] formula parsing and recomputation
  - [ ] large import/export transforms
  - [ ] expensive snapshot/chunk serialization if it becomes measurable
- [ ] Avoid full-document serialization on the main thread during active editing.
- [ ] Ensure background persistence work never blocks scroll, typing, or cursor movement.

## Must-Haves From the Assignment

- [ ] Dashboard lists documents with:
  - [ ] title
  - [ ] last modified
  - [ ] author / owner identity label
- [ ] Editor includes:
  - [ ] scrollable grid
  - [ ] numbered rows
  - [ ] lettered columnsm
  - [ ] editable cells
- [ ] Formula support includes at minimum:
  - [ ] basic arithmetic
  - [ ] cell references
  - [ ] `=SUM(...)`
- [ ] Realtime sync across multiple sessions of the same document.
- [ ] Presence UI showing active collaborators.
- [ ] Identity flow:
  - [ ] first-time user sets display name or signs in with Google
  - [ ] name sticks for the session
  - [ ] user color sticks for the session
- [ ] Write-state indicator:
  - [ ] local edit pending
  - [ ] synced / landed
  - [ ] reconnecting or degraded state if applicable
- [ ] Vercel-ready build with no ignored TypeScript errors.
- [ ] Private GitHub repo, deploy URL, and demo video prepared for submission.

## Explicit Non-Goals For This Submission

- [ ] Snapshot blobs and object storage archival.
- [ ] Rich version history UI.
- [ ] Full Excel formula coverage.
- [ ] Pivot tables, charts, macros, or import pipelines.
- [ ] Multi-sheet workbooks unless time remains after all must-haves are solid.

## Bonus Scope

- [ ] Cell formatting
- [ ] Row and column resize
- [ ] Keyboard navigation polish
- [ ] Reorder rows or columns by drag
- [ ] Export support

---

## Phase 0 - Assignment Framing and Repo Setup

### Goals

- [ ] Lock scope before building.
- [ ] Make build quality and submission requirements visible from day one.

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
  - [x] why `InstantDB` is limited to metadata
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
- [x] Define InstantDB collections / shape for:
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

- [ ] Integrate `HyperFormula` for the minimum formula scope required by the prompt.
- [ ] Run formula evaluation in a dedicated worker so editing and scrolling stay responsive.
- [ ] Keep supported function scope intentionally narrow and defensible.

### Checklist

- [ ] Support raw values:
  - [ ] text
  - [ ] number
- [ ] Detect formula inputs by leading `=`.
- [ ] Set up a dedicated formula worker.
- [ ] Initialize `HyperFormula` inside the worker.
- [ ] Define worker message protocol for:
  - [ ] sheet bootstrap
  - [ ] cell edit updates
  - [ ] recompute requests
  - [ ] computed value responses
  - [ ] formula error responses
- [ ] Map sheet cell coordinates to `HyperFormula` references.
- [ ] Support formula scope through `HyperFormula`:
  - [ ] basic arithmetic like `=A1+B1`
  - [ ] direct cell references
  - [ ] `SUM` over comma args or ranges
- [ ] Support ranges such as `A1:A5`.
- [ ] Recompute dependent cells on edit through the worker.
- [ ] Handle formula errors safely:
  - [ ] invalid reference
  - [ ] malformed expression
  - [ ] circular dependency basic guard
- [ ] Document the formula tradeoff in README:
  - [ ] why `HyperFormula` was chosen instead of a custom parser
  - [ ] why supported formula scope is intentionally limited for the assignment
  - [ ] why this is sufficient for the rubric

### Exit Criteria

- [ ] `=SUM(...)` works.
- [ ] Basic arithmetic across cell refs works.
- [ ] Formula evaluation is isolated from the main UI thread.
- [ ] Formula scope is explicit and justified.

---

## Phase 6 - Realtime Collaboration and Presence

### Goals

- [ ] Make multi-session editing correct and demoable.
- [ ] Keep latency low and collaboration state visible.
- [ ] Keep `Yjs` responsible for live sync while `InstantDB` remains metadata-only.

### Checklist

- [ ] Define `Yjs` document structure for:
  - [ ] cells
  - [ ] runtime sheet metadata needed during editing
- [ ] Implement Yjs provider / room connection lifecycle.
- [ ] Implement the low-latency local collaboration path first:
  - [ ] same-browser propagation through `BroadcastChannel`
  - [ ] refresh recovery from persisted local Yjs state
- [ ] Bootstrap the correct collaboration room from InstantDB document metadata.
- [ ] Propagate cell edits across sessions through Yjs updates.
- [ ] Define how local edits map to Yjs updates.
- [ ] Define how remote Yjs updates map into rendered sheet state.
- [ ] Ensure local edits are visible immediately before network acknowledgement.
- [ ] Document contention behavior:
  - [ ] CRDT-backed convergence through Yjs
  - [ ] any remaining UI-level conflict edge cases
- [ ] Implement presence state:
  - [ ] active users in document
  - [ ] name
  - [ ] color
  - [ ] optional current selection or active cell
- [ ] Use Yjs awareness for presence updates.
- [ ] Show active collaborators in the UI.
- [ ] Ensure identity is attached to presence consistently.
- [ ] Add instrumentation or lightweight timing logs for:
  - [ ] local edit to remote visible update
  - [ ] reconnect timing
- [ ] Validate target behavior with two-tab testing.

### Exit Criteria

- [ ] Two sessions stay in sync.
- [ ] Presence is visible and stable.
- [ ] Collaboration behavior is CRDT-based, correct, and documented.
- [ ] Local same-browser collaboration path is low-latency and robust enough to build on for cross-device sync.

---

## Phase 6B - Cross-Device Collaboration and Durable Yjs Persistence

### Goals

- [ ] Extend collaboration from local multi-tab to cross-device, cross-browser sessions.
- [ ] Keep local edits instant while minimizing cross-device propagation latency.
- [ ] Add durable Yjs-backed sheet persistence without breaking the `InstantDB` metadata-only boundary.

### Checklist

- [ ] Introduce a networked Yjs provider abstraction that can coexist with the local `BroadcastChannel` fast path.
- [ ] Choose a cross-device transport optimized for low latency:
  - [ ] region-close WebSocket-based Yjs provider
  - [ ] long-lived connection model suitable for frequent small updates
- [ ] Keep the editor transport-agnostic so same-browser and cross-device peers share the same Yjs room API.
- [ ] Ensure same-browser tabs still short-circuit through `BroadcastChannel` even when the networked provider is connected.
- [ ] Authenticate room access with the active user identity before joining the remote provider.
- [ ] Persist durable Yjs room state outside the browser so sheet contents survive:
  - [ ] full browser close
  - [ ] device switch
  - [ ] all clients disconnecting
- [ ] Keep persistence asynchronous relative to editing:
  - [ ] local cell edits mutate local `Yjs` first
  - [ ] remote peers receive provider updates before durable storage acknowledgement is required
  - [ ] durable writes happen on a debounced flush schedule
- [ ] Define the durability flush strategy explicitly:
  - [ ] debounce window for normal typing bursts
  - [ ] explicit flush on tab close / page hide where feasible
  - [ ] explicit flush on idle periods
  - [ ] retry behavior after transient provider or storage failures
- [ ] Store durable sheet content as encoded Yjs document state or Yjs-compatible updates.
- [ ] Do not mirror live cell-by-cell document state into `InstantDB`.
- [ ] Update room bootstrap flow to:
  - [ ] fetch metadata from `InstantDB`
  - [ ] connect local room transport
  - [ ] connect networked Yjs provider
  - [ ] hydrate from durable Yjs state when needed
- [ ] Optimize remote propagation path:
  - [ ] binary Yjs updates over the wire
  - [ ] no per-cell REST or JSON write amplification
  - [ ] coalesced presence traffic
  - [ ] bounded reconnection backoff
  - [ ] no synchronous persistence calls in the local edit path
- [ ] Ensure persistence work is isolated from UI hot paths:
  - [ ] no full-room serialization on every keystroke
  - [ ] no formula recomputation coupled directly to persistence flush timing
  - [ ] workerize any measured heavy persistence transforms
- [ ] Measure cross-device collaboration latency under realistic same-region conditions.
- [ ] Measure durability lag separately from collaboration latency so the two concerns are not conflated.
- [ ] Document the persistence boundary clearly in README:
  - [ ] `Yjs` and its durable store hold sheet contents
  - [ ] `InstantDB` holds metadata only

### Exit Criteria

- [ ] A document edited on one device appears on another device through the networked Yjs provider.
- [ ] Reloading from a different device restores the latest durable sheet contents.
- [ ] Same-browser collaboration remains fast after adding cross-device transport.
- [ ] Cross-device collaboration latency is measured and documented honestly.

---

## Phase 6C - Backend Consolidation and InstantDB Migration

### Goals

- [ ] Remove long-term dependency on `InstantDB` without disturbing already-completed phases.
- [ ] Consolidate metadata, chunk registry, and durable Yjs persistence into a more scalable backend shape.
- [ ] Keep the editor and collaboration layers stable while swapping backend ownership under clean interfaces.

### Checklist

- [ ] Define the target backend contract for:
  - [ ] document metadata
  - [ ] access control
  - [ ] collaboration room lookup
  - [ ] chunk registry
  - [ ] durable Yjs persistence references
- [ ] Introduce a metadata repository abstraction if the codebase does not already isolate `InstantDB`.
- [ ] Add a new backend implementation for:
  - [ ] document list and lookup
  - [ ] room bootstrap metadata
  - [ ] chunk discovery for large sheets
  - [ ] durable Yjs room and chunk persistence
- [ ] Keep the live collaboration flow local-first after migration:
  - [ ] backend writes remain asynchronous
  - [ ] provider fanout remains independent of metadata persistence
  - [ ] durable persistence cannot block local rendering
- [ ] Keep the live editor contract unchanged while migrating the dashboard and room bootstrap paths.
- [ ] Migrate existing document metadata from `InstantDB` to the new backend shape.
- [ ] Stop treating `InstantDB` as a required runtime dependency once the new backend is verified.
- [ ] Keep sheet contents out of row-per-cell relational writes; store them as Yjs-compatible chunked document state.
- [ ] Model the consolidated backend around two distinct paths:
  - [ ] hot path: room bootstrap, auth, low-latency provider connectivity
  - [ ] warm path: debounced durability, chunk registry updates, metadata refresh
- [ ] Define chunk durability semantics for dense sheets:
  - [ ] chunk identity
  - [ ] chunk version / revision tracking
  - [ ] flush granularity
  - [ ] restore order
- [ ] Ensure metadata writes such as `lastModified` are derived from debounced document activity rather than per-cell writes.
- [ ] Validate that migration preserves:
  - [ ] document open flow
  - [ ] room lookup
  - [ ] last modified semantics
  - [ ] access checks
  - [ ] cross-device restore
- [ ] Document the final backend split in README and architecture notes:
  - [ ] live collaboration in `Yjs`
  - [ ] durable chunked Yjs persistence for sheet contents
  - [ ] consolidated metadata and chunk registry backend
  - [ ] no `InstantDB` dependency in the final target architecture

### Exit Criteria

- [ ] `InstantDB` is no longer required by the target architecture.
- [ ] Metadata and chunk registry live in the consolidated backend.
- [ ] Durable sheet contents are stored as chunked Yjs-compatible state.
- [ ] Existing editor and dashboard flows continue to work through stable repository boundaries.

---

## Phase 7 - Performance Pass

### Goals

- [ ] Defend the `1M` logical cell goal and `<50ms` collaboration target with practical evidence.

### Checklist

- [ ] Create performance fixture documents:
  - [ ] sparse large grid
  - [ ] formula-heavy sample
  - [ ] multi-user edit sample
- [ ] Measure:
  - [ ] initial editor load time
  - [ ] scroll responsiveness on large logical sheets
  - [ ] edit-to-render latency
  - [ ] collaboration propagation latency across two sessions
  - [ ] collaboration propagation latency across two devices on the networked provider
  - [ ] rejoin and restore latency from durable Yjs persistence
  - [ ] durability flush lag during active typing bursts
- [ ] Optimize hot spots:
  - [ ] viewport calculation
  - [ ] rerender boundaries
  - [ ] subscription update fan-out
  - [ ] worker-based formula recalculation path
  - [ ] Yjs transport batching and provider message size
  - [ ] presence throttling under concurrent activity
  - [ ] persistence debounce window and flush cost
  - [ ] chunk serialize / deserialize cost
- [ ] Document real observed performance numbers.
- [ ] If `<50ms` is not consistently met, document realistic conditions and current bottlenecks honestly.

### Exit Criteria

- [ ] There is concrete evidence behind the performance claims.
- [ ] Large-sheet behavior is demoable.
- [ ] Collaboration latency story is measured, not guessed.
- [ ] Cross-device latency story is backed by real measurements, not assumptions.

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
- [ ] Deploy to Vercel.
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

- [ ] Dashboard works.
- [ ] Editor works.
- [ ] Formula support works.
- [ ] Collaboration works.

### Architecture

- [ ] Server and client boundaries are easy to explain.
- [ ] Realtime data flow is simple.
- [ ] State ownership is clear.
- [ ] `Yjs` live state vs `InstantDB` metadata split is easy to explain.

### Code Quality

- [ ] Strict TypeScript is maintained.
- [ ] Components are focused and not over-abstracted.
- [ ] Tailwind usage stays readable.

### Realtime Behaviour

- [ ] Concurrent edits converge predictably.
- [ ] Presence works reliably.
- [ ] Reconnect state is visible.
- [ ] Cross-device collaboration restores and converges correctly.

### Documentation

- [ ] README explains tradeoffs.
- [ ] Commit history tells a coherent story.
- [ ] Demo shows the important behaviors quickly.

## Final Build Order

1. [ ] Repo setup, strict config, README scaffold
2. [ ] Auth and identity
3. [ ] Dashboard
4. [ ] Sparse sheet model
5. [ ] Virtualized editor grid
6. [ ] Editing and write-state indicator
7. [ ] Formula support
8. [ ] Realtime sync and presence
8.5. [ ] Cross-device collaboration transport and durable Yjs persistence
8.75. [ ] Backend consolidation and InstantDB migration
9. [ ] Performance pass
10. [ ] Bonus features only if stable
11. [ ] Submission packaging

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

### Source of Truth Rules

- [ ] `Yjs` is the source of truth for live document cells and collaborator presence.
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
- [ ] Bootstrap the correct collaboration room from InstantDB document metadata.
- [ ] Propagate cell edits across sessions through Yjs updates.
- [ ] Define how local edits map to Yjs updates.
- [ ] Define how remote Yjs updates map into rendered sheet state.
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
- [ ] Optimize hot spots:
  - [ ] viewport calculation
  - [ ] rerender boundaries
  - [ ] subscription update fan-out
  - [ ] worker-based formula recalculation path
- [ ] Document real observed performance numbers.
- [ ] If `<50ms` is not consistently met, document realistic conditions and current bottlenecks honestly.

### Exit Criteria

- [ ] There is concrete evidence behind the performance claims.
- [ ] Large-sheet behavior is demoable.
- [ ] Collaboration latency story is measured, not guessed.

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
9. [ ] Performance pass
10. [ ] Bonus features only if stable
11. [ ] Submission packaging

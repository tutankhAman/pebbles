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
  - [ ] lettered columns
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

- [ ] Create repo structure for a single Next.js app with internal feature folders or lightweight packages only if needed.
- [ ] Configure:
  - [ ] strict TypeScript
  - [ ] Biome
  - [ ] Tailwind CSS
- [ ] Add CI or local scripts for:
  - [ ] typecheck
  - [ ] lint
  - [ ] build
- [ ] Create a short architecture note that explains:
  - [ ] why `Yjs` is used for live collaboration
  - [ ] why `InstantDB` is limited to metadata
  - [ ] why Firebase Auth is used for identity
  - [ ] why HyperFormula is used for formulas
  - [ ] why formula evaluation runs in a separate worker
  - [ ] how contention is handled
  - [ ] what formula scope is intentionally limited
  - [ ] what is deliberately out of scope
- [ ] Create a minimal README scaffold with sections for:
  - [ ] setup
  - [ ] architecture
  - [ ] tradeoffs
  - [ ] demo instructions
  - [ ] submission checklist

### Exit Criteria

- [ ] App boots locally.
- [ ] Typecheck, lint, and build scripts exist.
- [ ] Scope and tradeoffs are documented before feature work starts.

---

## Phase 1 - Auth, Identity, and Document Dashboard

### Goals

- [ ] Ship the required home screen and user identity flow first.

### Checklist

- [ ] Set up Firebase Auth with Google sign-in.
- [ ] Add first-time identity fallback:
  - [ ] prompt for display name if not signed in
  - [ ] assign deterministic session color
- [ ] Persist session identity needed for collaboration presence.
- [ ] Define InstantDB collections / shape for:
  - [ ] users
  - [ ] documents
  - [ ] document membership or access records if needed
  - [ ] document metadata
- [ ] Define metadata fields:
  - [ ] title
  - [ ] last modified timestamp
  - [ ] author / owner
  - [ ] collaboration room identifier
- [ ] Implement dashboard view showing:
  - [ ] document title
  - [ ] last modified timestamp
  - [ ] author / owner
- [ ] Implement create document action.
- [ ] Implement open existing document action.
- [ ] Implement update of `last modified` when document content changes.
- [ ] Make dashboard responsive and clean enough for demo use.

### Exit Criteria

- [ ] New user can set identity or sign in.
- [ ] User can create and open documents.
- [ ] Dashboard visibly satisfies the assignment requirement.

---

## Phase 2 - Spreadsheet Data Model and 1M-Cell Strategy

### Goals

- [ ] Design the sheet model around sparse storage and cheap viewport reads.
- [ ] Support large logical grids without allocating large matrices.

### Checklist

- [ ] Define core types:
  - [ ] `CellAddress`
  - [ ] `CellContent`
  - [ ] `FormulaInput`
  - [ ] `ComputedValue`
  - [ ] `Selection`
  - [ ] `Viewport`
- [ ] Choose internal cell key format:
  - [ ] row and column coordinates as canonical internal form
  - [ ] `A1` helpers for display and parsing
- [ ] Implement sparse storage:
  - [ ] only non-empty cells are stored
  - [ ] empty cells are derived implicitly
- [ ] Define logical sheet bounds that allow `1M` addressable cells.
- [ ] Add chunk/window helpers for viewport access.
- [ ] Implement core operations:
  - [ ] set cell
  - [ ] clear cell
  - [ ] read cell
  - [ ] read rectangular range
  - [ ] batch paste range
- [ ] Add tests for:
  - [ ] address conversions
  - [ ] sparse reads and writes
  - [ ] large logical grid access

### Exit Criteria

- [ ] Data model supports `1M` logical cells without dense allocation.
- [ ] Core cell operations are stable and test-covered.

---

## Phase 3 - Grid Rendering and Viewport Virtualization

### Goals

- [ ] Render a fast, scrollable grid suitable for the assignment demo.
- [ ] Only render what is visible plus a small buffer.

### Checklist

- [ ] Implement spreadsheet viewport model:
  - [ ] scroll position
  - [ ] visible row range
  - [ ] visible column range
  - [ ] overscan buffer
- [ ] Render:
  - [ ] column headers with letters
  - [ ] row headers with numbers
  - [ ] visible cell window
- [ ] Ensure editor grid scrolls smoothly on large logical sheets.
- [ ] Map pointer coordinates to cell coordinates.
- [ ] Implement active-cell and selection visuals.
- [ ] Avoid rendering the full logical grid.
- [ ] Measure:
  - [ ] scroll smoothness
  - [ ] visible window computation cost
  - [ ] cost of selection updates

### Exit Criteria

- [ ] Grid is scrollable and usable.
- [ ] Rendering strategy clearly supports large logical sheets.
- [ ] Demoing large-sheet scrolling is plausible without visible collapse.

---

## Phase 4 - Editing, Navigation, and Write-State Indicator

### Goals

- [ ] Make editing feel spreadsheet-like.
- [ ] Expose sync state clearly to the user.

### Checklist

- [ ] Implement editable cell interaction:
  - [ ] click to select
  - [ ] double click or direct typing to edit
  - [ ] commit on enter / blur
- [ ] Implement keyboard navigation:
  - [ ] arrow keys
  - [ ] tab
  - [ ] enter
  - [ ] escape
- [ ] Implement rectangular selection.
- [ ] Implement copy and paste for rectangular cell data if time allows inside core scope.
- [ ] Add write-state indicator states:
  - [ ] `Saving...`
  - [ ] `Saved`
  - [ ] `Reconnecting...`
  - [ ] optional `Offline`
- [ ] Define when state transitions occur:
  - [ ] local edit queued
  - [ ] server ack or subscription confirmation received
  - [ ] connection lost
  - [ ] connection restored
- [ ] Add tests for:
  - [ ] keyboard movement
  - [ ] edit commit behavior
  - [ ] write-state transitions

### Exit Criteria

- [ ] Editing works reliably.
- [ ] Navigation behaves as expected for core keys.
- [ ] Write-state indicator is visible and understandable.

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

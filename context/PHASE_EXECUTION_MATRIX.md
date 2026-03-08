# Phase Execution Matrix

## Purpose

This document explains how to execute [PLAN.md](/home/haze/repos/pebbles/context/PLAN.md) with multi-agent coding without changing the plan itself.

The core rule is:

- keep the main phase checklist as the source of truth
- use this matrix only to decide who does what, when parallelism is safe, and when integration must happen

## Execution Formula

Every phase should be executed as:

```text
Shared setup by main agent
→ parallel worker implementation where safe
→ main-agent integration
→ verification against phase exit criteria
→ only then move to the next phase
```

## Global Rules

- The main agent owns shared contracts and integration.
- Workers only own disjoint file surfaces.
- Do not spawn multiple workers on the same editor subtree unless one is read-only.
- Do not parallelize global config churn.
- Do not start a new phase until the current phase exit criteria are checked.
- If a phase has highly coupled files, prefer one worker plus the main integrator.

## Worker Legend

- `Main Agent`: contracts, integration, verification, docs
- `Agent A`: auth, identity, dashboard, InstantDB metadata
- `Agent B`: sheet model, viewport, grid rendering, editor shell
- `Agent C`: Yjs collaboration, room lifecycle, presence
- `Agent D`: HyperFormula worker and formula adapter
- `Agent E`: optional polish and submission support

---

## Phase 0 - Assignment Framing and Repo Setup

### Parallelization decision

- `Do not parallelize`

### Why

- This phase touches global config and shared foundations.
- Parallelizing `tsconfig`, lint config, Tailwind setup, route skeleton, or shared types usually causes churn instead of speed.

### Main agent tasks

- Create the initial Next.js app structure.
- Configure strict TypeScript, ESLint, Prettier, Tailwind.
- Add `typecheck`, `lint`, and `build` scripts.
- Create route skeleton.
- Create shared type files and contract placeholders.
- Create README scaffold.
- Confirm architecture alignment with [ARCHITECTURE.md](/home/haze/repos/pebbles/context/ARCHITECTURE.md).

### Safe worker tasks

- None recommended.

### Do not parallelize

- `package.json`
- `tsconfig.json`
- Tailwind config
- ESLint config
- root app routes
- shared type definition files

### Phase exit checks

- App boots locally.
- Shared contracts exist.
- Typecheck, lint, and build scripts exist.
- Route skeleton is stable enough for downstream workers.

---

## Phase 1 - Auth, Identity, and Document Dashboard

### Parallelization decision

- `Partially parallelize`

### Main agent tasks first

- Define `SessionIdentity`, `UserMeta`, `DocumentMeta`.
- Define route contracts:
  - dashboard route
  - document editor route
- Define metadata client boundaries and room-id semantics.

### Parallel worker tasks

- `Agent A`
  - Firebase Auth setup
  - session bootstrap
  - display-name fallback
  - InstantDB metadata queries and mutations
- `Agent B`
  - dashboard UI shell only if file ownership is clearly isolated from Agent A

### Main agent integration tasks

- Wire auth provider into app shell.
- Connect dashboard UI to metadata actions.
- Verify document creation returns navigable editor route params.
- Verify document metadata includes room id.

### Do not parallelize

- shared metadata type definitions after workers begin
- route param shape
- metadata model naming churn

### Phase exit checks

- User can sign in or establish a session identity.
- Dashboard shows title, last modified, owner.
- Create document works.
- Open document navigates correctly into the editor route.

---

## Phase 2 - Spreadsheet Data Model and 1M-Cell Strategy

### Parallelization decision

- `Light parallelization`

### Main agent tasks first

- Lock spreadsheet contracts:
  - `CellAddress`
  - `CellRecord`
  - `Selection`
  - `Viewport`
  - canonical `row:col` key format
- Lock logical grid assumptions for `1M` cells.

### Parallel worker tasks

- `Agent B`
  - sparse cell helpers
  - address conversion helpers
  - visible-range access helpers

Optional split if codebase is large enough:

- `Agent B1`
  - cell addressing and sparse storage
- `Agent B2`
  - viewport math and visible range helpers

### Main agent integration tasks

- Merge helper surfaces into a coherent sheet model.
- Add tests for shared contracts and edge cases.
- Confirm helpers match planned collaboration and formula inputs.

### Do not parallelize

- the same spreadsheet type files
- canonical key format changes after implementation starts

### Phase exit checks

- Sparse data helpers work.
- `1M` logical cells are supported by design.
- Address conversion is stable and tested.

---

## Phase 3 - Grid Rendering and Viewport Virtualization

### Parallelization decision

- `Mostly single-owner`

### Why

- Grid rendering is a tightly coupled subtree.
- Parallelizing headers, selection, and cell window rendering often causes merge conflicts and layout regressions.

### Main agent tasks first

- Confirm rendering direction:
  - DOM virtualization first
  - canvas only if necessary later
- Lock editor shell component boundaries.

### Parallel worker tasks

- `Agent B`
  - grid rendering shell
  - row/column headers
  - visible cell rendering
  - viewport math usage
  - selection visuals

Possible low-risk helper work:

- `Agent E`
  - styling-only polish on already stable presentational components

### Main agent integration tasks

- Verify the editor route mounts the grid correctly.
- Verify render boundaries are reasonable.
- Verify no full-grid rendering happens.

### Do not parallelize

- main editor component tree
- scroll container implementation
- selection overlay logic across multiple workers

### Phase exit checks

- Grid scrolls.
- Row and column headers render correctly.
- Visible-only rendering is working.
- Large logical sheet scrolling is plausible.

---

## Phase 4 - Editing, Navigation, and Write-State Indicator

### Parallelization decision

- `Partially parallelize`

### Main agent tasks first

- Lock `WriteState` enum and transition contract.
- Lock editing state boundaries between editor shell and collaboration status.

### Parallel worker tasks

- `Agent B`
  - keyboard navigation
  - active editor overlay
  - pointer selection behavior
- `Agent C`
  - collaboration status hooks used by write-state indicator
  - reconnect status surface

### Main agent integration tasks

- Wire `WriteState` into editor UI.
- Ensure navigation does not fight collaboration-driven updates.
- Verify edit commit flows feed both Yjs and formula worker pathways later.

### Do not parallelize

- same editor input component
- write-state enum definition after workers start

### Phase exit checks

- Cell editing works.
- Arrow/Tab/Enter/Escape work as expected.
- Write-state indicator changes meaningfully.

---

## Phase 5 - Formula Engine Scope

### Parallelization decision

- `High-value isolated parallelization`

### Why

- Formula work is naturally isolated behind a worker boundary.

### Main agent tasks first

- Lock `FormulaWorkerRequest` and `FormulaWorkerResponse`.
- Lock mapping rules between `row:col` and sheet coordinates.

### Parallel worker tasks

- `Agent D`
  - worker setup
  - HyperFormula initialization
  - request handling
  - recompute outputs
  - formula error outputs

### Main agent integration tasks

- Connect worker lifecycle to editor route.
- Feed changed cells to worker.
- Apply computed results into rendered state.
- Verify formulas do not block editing.

### Do not parallelize

- worker protocol types after worker implementation starts
- formula adapter integration points across multiple workers

### Phase exit checks

- `SUM` works.
- Basic arithmetic works.
- Formula errors are surfaced.
- Formula work stays off the main thread.

---

## Phase 6 - Realtime Collaboration and Presence

### Parallelization decision

- `High-value isolated parallelization`

### Why

- Yjs collaboration can be built mostly behind clean hooks and adapters.

### Main agent tasks first

- Lock Yjs document shape.
- Lock room bootstrap contract from metadata to live collaboration.
- Lock awareness payload shape:
  - user id
  - display name
  - color
  - optional active cell / selection

### Parallel worker tasks

- `Agent C`
  - Yjs room lifecycle
  - local edit to Yjs mapping
  - remote update listeners
  - awareness presence
  - collaboration status hooks

### Main agent integration tasks

- Connect editor edits to Yjs adapter.
- Connect metadata-derived room id to collaboration bootstrap.
- Connect presence UI to awareness data.
- Confirm collaboration and formula updates do not fight each other.

### Do not parallelize

- Yjs document schema changes after implementation starts
- multiple workers editing room lifecycle files
- same presence UI component if it is tightly tied to hooks

### Phase exit checks

- Two tabs stay in sync.
- Presence is visible.
- Yjs room join flow is stable.
- CRDT-based convergence is working as intended.

---

## Phase 6B - Cross-Device Collaboration and Durable Yjs Persistence

### Parallelization decision

- `Isolated transport and persistence parallelization`

### Why

- Cross-device transport and durable Yjs persistence can stay behind collaboration-facing interfaces if the room API is already locked.

### Main agent tasks first

- Lock the transport abstraction:
  - local `BroadcastChannel` fast path
  - networked provider path
- Lock durable Yjs persistence contract.
- Lock the boundary between room bootstrap metadata and provider connection.

### Parallel worker tasks

- `Agent C`
  - networked provider integration
  - reconnect behavior
  - awareness propagation tuning
- `Agent F`
  - durable Yjs persistence adapter
  - chunk registry contract support if introduced in this phase

### Main agent integration tasks

- Keep same-browser collaboration fast after networked provider is added.
- Verify local-first edits still land before network acknowledgement.
- Verify cross-device restore path from durable Yjs persistence.

### Do not parallelize

- changing the app-facing room API in multiple places at once
- mixing provider transport work with broad editor rewrites
- persistence format churn after clients depend on it

### Phase exit checks

- Same-browser tabs still sync through the fast path.
- Cross-device sessions can join and converge.
- Durable Yjs restore works across browser/device boundaries.

---

## Phase 6C - Backend Consolidation and InstantDB Migration

### Parallelization decision

- `Repository-boundary migration with isolated backend work`

### Why

- This phase should not churn completed editor work. It is safest when the backend swap happens behind stable repository interfaces.

### Main agent tasks first

- Lock metadata repository interfaces.
- Lock chunk-registry contract.
- Lock migration success criteria:
  - dashboard still works
  - room lookup still works
  - access metadata still works

### Parallel worker tasks

- `Agent F`
  - new backend integration
  - metadata migration
  - chunk-registry and persistence references
- `Agent A`
  - minimal dashboard/query adjustments only if repository interfaces require them

### Main agent integration tasks

- Swap runtime wiring from `InstantDB` to the consolidated backend.
- Keep the editor and collaboration APIs unchanged where possible.
- Verify migration does not break document open flow.

### Do not parallelize

- the same repository interface files across multiple workers
- editor collaboration code and metadata backend swaps in one mixed refactor

### Phase exit checks

- `InstantDB` is no longer on the critical runtime path.
- Metadata and chunk-registry lookups come from the consolidated backend.
- Existing editor flows still work.

---

## Phase 7 - Performance Pass

### Parallelization decision

- `Main-agent led`

### Why

- Performance work is mostly integration, profiling, and bottleneck removal.
- Parallelizing optimization too early tends to waste effort.

### Main agent tasks

- Measure:
  - editor load time
  - visible-grid scroll behavior
  - local edit to remote visible update latency
  - cross-device visible update latency
  - formula recompute latency
  - durable restore latency
- Identify top bottlenecks.
- Patch the highest-signal issues first.

### Safe worker tasks

- `Agent E`
  - low-risk instrumentation UI
  - benchmark fixture helpers

Possible targeted delegation after profiling:

- `Agent B`
  - rerender boundary optimization
- `Agent C`
  - Yjs update batching improvements
- `Agent D`
  - worker recomputation batching
- `Agent F`
  - chunk hydrate / persistence-path optimization

### Do not parallelize

- random speculative optimizations before measurements exist
- broad refactors across all feature areas at once

### Phase exit checks

- You have measured numbers, not guesses.
- Large logical sheet behavior is acceptable.
- Collaboration latency story is evidence-backed.

---

## Phase 8 - Bonus Features

### Parallelization decision

- `Only after MVP is stable`

### Main agent tasks first

- Decide which bonuses are worth doing.
- Rank them by rubric value and implementation risk.

### Parallel worker tasks

- `Agent B`
  - keyboard polish
  - row/column resize
- `Agent E`
  - formatting UI polish
- another isolated worker only if ownership is very clear

### Main agent integration tasks

- Ensure bonus work does not break collaboration or formulas.
- Cut unstable bonuses quickly.

### Do not parallelize

- multiple workers on the same bonus component tree
- bonus work before MVP validation

### Phase exit checks

- Core app is still stable.
- Bonus features are demo-safe.

---

## Phase 9 - Submission Packaging

### Parallelization decision

- `Main-agent led with optional polish support`

### Main agent tasks

- Run final typecheck, lint, build.
- Finalize README.
- Verify demo script.
- Verify submission checklist.
- Prepare repo and deploy artifacts.

### Safe worker tasks

- `Agent E`
  - README polish
  - small visual polish
  - empty/loading/error state cleanup

### Do not parallelize

- final build verification
- final README architecture narrative across multiple workers
- submission checklist ownership

### Phase exit checks

- Private repo is ready.
- Deploy URL works.
- Demo is recordable.
- Submission requirements are satisfied.

---

## Recommended Real Execution Sequence

### Stage 1

- Main agent completes Phase 0 solo.

### Stage 2

- Main agent locks shared contracts for Phase 1.
- Spawn `Agent A`.
- Optionally spawn `Agent B` for dashboard-only UI if ownership is clean.
- Main agent integrates and verifies Phase 1.

### Stage 3

- Main agent locks spreadsheet contracts for Phase 2.
- Spawn `Agent B`.
- Main agent verifies Phase 2.

### Stage 4

- Keep `Agent B` on Phase 3 and Phase 4 editor work.
- Main agent locks `WriteState`.

### Stage 5

- Main agent locks formula worker contracts.
- Spawn `Agent D`.

### Stage 6

- Main agent locks Yjs room and awareness contracts.
- Spawn `Agent C`.

### Stage 7

- Main agent integrates Agent B + Agent D + Agent C into the editor route.
- Main agent verifies full MVP flow.

### Stage 8

- Main agent locks transport and persistence contracts for cross-device sync.
- Spawn `Agent C` and `Agent F` for Phase 6B where useful.
- Main agent verifies cross-device restore and provider behavior.

### Stage 9

- Main agent locks repository boundaries for backend consolidation.
- Spawn `Agent F` for Phase 6C.
- Main agent verifies the InstantDB migration path.

### Stage 10

- Main agent performs performance pass.
- Delegate only targeted bottlenecks after profiling.

### Stage 11

- Optional `Agent E` for polish.
- Main agent finalizes submission packaging.

---

## Minimal Spawn Plan

If you want the simplest useful multi-agent strategy, use this:

1. Main agent: Phase 0 and all shared contracts
2. `Agent A`: auth + dashboard
3. `Agent B`: sheet model + grid + editing shell
4. `Agent D`: formula worker
5. `Agent C`: Yjs collaboration + presence
6. `Agent F`: backend consolidation and persistence migration when the codebase is ready
7. Main agent: integration, performance, submission

This is the best balance between speed and coordination cost.

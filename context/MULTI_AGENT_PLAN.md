# Multi-Agent Execution Plan

## Purpose

Use parallel coding agents to minimize total implementation time while avoiding merge conflicts and architectural drift.

This split assumes the current architecture:

- `Next.js` App Router
- `TypeScript`
- `Tailwind CSS`
- `Firebase Auth`
- `InstantDB` for metadata
- `Yjs` for live collaboration and presence
- `HyperFormula` in a dedicated worker
- `Zustand` for ephemeral UI state

## Operating Rules

- One agent owns one write surface.
- Shared contracts are defined before parallel implementation starts.
- Workers must not rewrite another agent's files.
- The main agent handles integration, conflict resolution, final verification, and documentation.
- Workers should assume other agents are editing the codebase in parallel and must not revert their changes.

## Shared Contracts To Lock First

These should be created by the main agent before parallel work starts:

- `CellAddress`
- `CellRecord`
- `DocumentMeta`
- `SessionIdentity`
- `Selection`
- `Viewport`
- `WriteState`
- `FormulaWorkerRequest`
- `FormulaWorkerResponse`
- shared env/config wrappers for Firebase, InstantDB, and Yjs provider bootstrap

Suggested files:

```text
apps/web/src/types/spreadsheet.ts
apps/web/src/types/collaboration.ts
apps/web/src/types/formula-worker.ts
apps/web/src/types/metadata.ts
apps/web/src/types/ui.ts
```

---

## Main Agent

### Description

Technical lead and integration owner. Defines shared interfaces, enforces architectural boundaries, merges the workstreams, runs validation, and prepares final submission artifacts.

### Ownership

- app routing skeleton
- shared type contracts
- provider composition
- final editor wiring
- build/type/lint verification
- README and demo preparation

### Files / Areas

```text
apps/web/src/app/**
apps/web/src/types/**
apps/web/src/providers/**
apps/web/package.json
apps/web/tsconfig.json
apps/web/tailwind.config.*
apps/web/README.md
```

### Prompt

```text
You are the main integration owner for a collaborative spreadsheet app.

Architecture is fixed:
- Next.js App Router
- Tailwind CSS
- TypeScript strict mode
- Firebase Auth for identity
- InstantDB for metadata only
- Yjs for live collaborative sheet state and presence
- HyperFormula in a dedicated worker
- Zustand for ephemeral UI state only

Your responsibilities:
- define and implement shared contracts first
- scaffold provider boundaries and app routes
- integrate parallel worker outputs without breaking ownership boundaries
- do not reimplement sub-agent work unless integration requires a minimal patch
- keep the architecture aligned with ARCHITECTURE.md and PLAN.md

Important rules:
- other workers are editing in parallel
- do not revert their changes
- if a contract must change, update the contract and adapt integration points cleanly
- keep code simple and assignment-focused

Primary deliverables:
- shared types and route skeleton
- final app wiring
- final verification and submission-readiness
```

### Task List

- Create initial route skeleton:
  - dashboard route
  - document editor route
- Define all shared type contracts.
- Define app-level provider composition.
- Create base layout and global styles wiring.
- Integrate auth state into app shell.
- Integrate metadata lookup with document open flow.
- Integrate Yjs room bootstrap into editor route.
- Integrate formula worker outputs into visible cell rendering.
- Resolve cross-stream type mismatches.
- Run final typecheck, lint, and build.
- Prepare final README and submission notes.

---

## Agent A - Auth and Dashboard

### Description

Owns identity flows and the metadata-driven dashboard experience.

### Ownership

- Firebase Auth client setup
- first-session display-name fallback
- InstantDB metadata access
- dashboard UI
- create/open document flows

### Files / Areas

```text
apps/web/src/features/auth/**
apps/web/src/features/dashboard/**
apps/web/src/lib/firebase/**
apps/web/src/lib/instantdb/**
```

### Prompt

```text
You own auth and dashboard for a collaborative spreadsheet app.

Architecture is fixed:
- Firebase Auth for identity
- InstantDB for metadata only
- Yjs is not your ownership except for consuming room ids from metadata

Your ownership:
- auth setup
- session identity bootstrap
- display-name fallback UX if needed
- metadata queries and mutations
- dashboard page and create/open document flow

Do not edit:
- spreadsheet editor internals
- Yjs collaboration files
- formula worker files
- shared contracts unless integration requires coordination

Other workers are editing in parallel. Do not revert their work.

Deliver:
- Google sign-in
- stable session identity shape for collaborators
- dashboard listing documents with title, last modified, owner
- create document flow returning a document id and room id
- clean UI suitable for a demo

List every file you changed in your final message.
```

### Task List

- Set up Firebase Auth client utilities.
- Implement auth session hook/provider.
- Implement display-name fallback flow if user is not fully provisioned.
- Implement deterministic session color generation.
- Implement InstantDB metadata client utilities.
- Define metadata query and mutation helpers:
  - list documents
  - create document
  - fetch document by id
  - update last modified
- Build dashboard page.
- Add create document CTA and navigation into editor route.
- Ensure dashboard shows:
  - title
  - last modified
  - owner / author

---

## Agent B - Sheet Model and Grid Rendering

### Description

Owns the spreadsheet data model, sparse storage helpers, viewport virtualization, and editor rendering shell.

### Ownership

- cell addressing
- sparse data helpers
- viewport math
- visible grid rendering
- selection model
- keyboard and pointer interaction shell

### Files / Areas

```text
apps/web/src/features/spreadsheet/**
apps/web/src/stores/ui-store.ts
```

### Prompt

```text
You own the spreadsheet model and editor rendering shell.

Architecture is fixed:
- sparse sheet model
- support 1M logical cells
- virtualized rendering
- Yjs provides live cell data but you do not own provider implementation
- HyperFormula worker provides computed values but you do not own worker implementation
- Zustand only stores ephemeral UI state

Your ownership:
- cell key helpers
- selection model
- viewport calculations
- visible cell rendering
- editor interaction shell

Do not edit:
- auth or dashboard files
- Yjs provider implementation
- formula worker internals
- shared contracts unless required for integration

Other workers are editing in parallel. Do not revert their work.

Deliver:
- fast visible-window rendering
- row/column headers
- active selection visuals
- editing surface ready for collaboration and formula integration

List every file you changed in your final message.
```

### Task List

- Implement cell coordinate helpers.
- Implement `row:col` key conversion helpers.
- Implement sparse visible-range access helpers.
- Implement viewport math and overscan.
- Build the scrollable grid shell.
- Render row numbers and column letters.
- Render visible cell window.
- Implement selected cell / selected range state usage.
- Implement pointer-to-cell hit testing.
- Implement base keyboard navigation hooks:
  - arrow keys
  - tab
  - enter
  - escape
- Implement floating editor overlay hooks and shell component.
- Keep rerender boundaries tight.

---

## Agent C - Collaboration and Presence

### Description

Owns Yjs live-state wiring, awareness presence, room lifecycle, and projection between Yjs updates and the local editor data model.

### Ownership

- Yjs document schema
- provider/bootstrap layer
- room lifecycle
- awareness presence
- edit propagation
- remote update projection

### Files / Areas

```text
apps/web/src/features/collaboration/**
apps/web/src/lib/yjs/**
```

### Prompt

```text
You own live collaboration and presence for a spreadsheet app.

Architecture is fixed:
- Yjs is the source of truth for live cells and presence
- InstantDB is metadata only
- Firebase Auth provides identity
- HyperFormula worker is separate and not your ownership

Your ownership:
- Yjs doc schema
- room bootstrap using room id supplied by metadata
- awareness state
- local edit to Yjs sync
- remote Yjs update projection back into app-facing state

Do not edit:
- auth/dashboard files
- spreadsheet grid rendering internals beyond collaboration adapters
- formula worker internals
- shared contracts unless required for integration

Other workers are editing in parallel. Do not revert their work.

Deliver:
- stable Yjs room join flow
- cell sync across tabs
- presence list and awareness payloads
- clean APIs for the editor to consume

List every file you changed in your final message.
```

### Task List

- Define Yjs document shape for cells and runtime metadata.
- Implement Yjs room bootstrap helpers.
- Implement collaboration provider/hook surface.
- Implement local cell upsert/delete mapping into Yjs.
- Implement remote update listeners.
- Implement awareness payload:
  - user id
  - display name
  - color
  - optional active cell / selection
- Implement presence subscription utilities.
- Expose collaboration status hooks for write-state and reconnect UI.
- Make two-tab sync path straightforward for the main integrator.

---

## Agent D - Formula Worker

### Description

Owns HyperFormula integration and the dedicated formula worker protocol.

### Ownership

- formula worker runtime
- HyperFormula initialization
- request/response protocol
- formula recomputation path
- error reporting for formulas

### Files / Areas

```text
apps/web/src/features/formulas/**
apps/web/src/workers/formula.worker.ts
apps/web/src/lib/worker/**
```

### Prompt

```text
You own formula evaluation for a collaborative spreadsheet app.

Architecture is fixed:
- HyperFormula runs in a dedicated worker
- raw cell source strings come from shared sheet state
- computed values are derived outputs for rendering only
- supported formula scope is intentionally narrow: arithmetic, direct refs, ranges, SUM, and optionally AVERAGE if free

Your ownership:
- worker setup
- HyperFormula bootstrapping
- worker request/response handling
- cell update ingestion
- recompute result emission
- formula error reporting

Do not edit:
- auth/dashboard files
- Yjs provider implementation
- spreadsheet grid rendering internals except formula adapters
- shared contracts unless required for integration

Other workers are editing in parallel. Do not revert their work.

Deliver:
- stable worker protocol
- HyperFormula-backed recomputation
- main-thread-safe formula execution
- clean adapter for editor integration

List every file you changed in your final message.
```

### Task List

- Implement worker entry file.
- Initialize HyperFormula in worker context.
- Implement worker message handlers:
  - bootstrap
  - cell upsert
  - cell delete
  - batch upsert
  - recompute visible
- Implement mapping between `row:col` keys and HyperFormula coordinates.
- Return computed values keyed by canonical cell keys.
- Return formula errors in a renderable format.
- Expose main-thread helper for worker lifecycle and messaging.
- Keep formula scope aligned with the assignment.

---

## Optional Agent E - UI Polish and Submission Support

### Description

Owns low-risk polish and submission-facing presentation once the core app is integrated.

### Ownership

- UI refinement
- empty states
- loading states
- README polish assistance
- demo prep support

### Files / Areas

```text
apps/web/src/components/**
apps/web/src/features/**/ui/**
README.md
```

### Prompt

```text
You own low-risk UI polish and submission support for a spreadsheet assignment.

Do not change architecture or shared contracts.
Do not touch collaboration internals, worker internals, or auth plumbing unless asked.

Your job is to improve:
- visual polish
- empty/loading/error states
- presence presentation
- write-state clarity
- README/demo clarity

Other workers are editing in parallel. Do not revert their work.

List every file you changed in your final message.
```

### Task List

- Improve loading and empty states.
- Refine write-state indicator presentation.
- Refine collaborator list / presence chips.
- Improve dashboard visual polish.
- Improve editor shell polish without destabilizing behavior.
- Help tighten README language if requested.

---

## Recommended Spawn Order

1. Main agent creates route skeleton and shared contracts.
2. Spawn Agent A, Agent B, Agent C, and Agent D in parallel.
3. Main agent integrates Agent B and Agent D first.
4. Main agent integrates Agent C into the editor.
5. Main agent connects Agent A dashboard flow to room bootstrap.
6. Spawn Agent E only after the core path is stable.

## Integration Checkpoints

### Checkpoint 1

- shared contracts compile
- route skeleton exists
- auth and dashboard boot

### Checkpoint 2

- editor renders visible grid
- formula worker responds
- collaboration room can connect

### Checkpoint 3

- local edit updates visible cell
- remote tab receives the edit
- formulas recompute after edit
- presence is visible
- write-state indicator behaves coherently

### Checkpoint 4

- typecheck passes
- lint passes
- production build passes
- demo flow is recordable

## What The Main Agent Should Never Parallelize

- final shared type definitions after workers begin
- root route structure churn
- global config churn across multiple workers
- the same editor component files across multiple workers
- late-stage architectural rewrites

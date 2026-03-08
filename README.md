# Pebbles

Lightweight real-time collaborative spreadsheet built for the Trademarkia frontend engineering assignment.

## Current Status

Phase `0` is complete:

- Next.js App Router scaffold is in place
- strict TypeScript, Tailwind, Biome/Ultracite, and build scripts are configured
- route skeleton exists for dashboard and document editor
- shared contracts exist for metadata, spreadsheet, collaboration, worker, and UI state
- architecture and planning docs live under [`context/`](./context)

## Architecture

Core design:

- `Firebase Auth` for identity
- `InstantDB` for metadata only
- `Yjs` for live collaborative state and presence
- `HyperFormula` in a dedicated worker for formulas
- `Zustand` for ephemeral UI state

Reference docs:

- [Plan](./context/PLAN.md)
- [Architecture](./context/ARCHITECTURE.md)
- [Multi-Agent Plan](./context/MULTI_AGENT_PLAN.md)
- [Phase Execution Matrix](./context/PHASE_EXECUTION_MATRIX.md)

## Setup

Install dependencies and start the development server:

```bash
bun install
bun run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
bun run dev
bun run typecheck
bun run lint
bun run build
bun run fix
```

## Project Structure

```text
src/
  app/
    dashboard/
    documents/[documentId]/
  providers/
  types/
context/
  PLAN.md
  ARCHITECTURE.md
  MULTI_AGENT_PLAN.md
  PHASE_EXECUTION_MATRIX.md
```

## Tradeoffs

- The submission is assignment-focused, not product-complete.
- Metadata and live collaboration are intentionally split.
- Snapshot/versioning/object storage are deferred.
- `HyperFormula` is used instead of a custom parser because correctness and dependency tracking matter more than writing formula code from scratch for this assignment.
- Formula evaluation runs in a dedicated worker so scroll and edit interactions stay responsive while recalculation happens off the main thread.
- Formula scope stays intentionally narrow even with `HyperFormula`:
  - arithmetic such as `=A1+B1`
  - direct cell references
  - `SUM(...)` over arguments or ranges
- That scope is enough for the assignment rubric while keeping the implementation explainable.

## Demo Notes

Planned demo flow:

- open dashboard
- create or open a document
- open the same document in two tabs
- show live collaboration, presence, and write-state behavior
- show `SUM` and basic arithmetic formulas

## Submission Checklist

- [ ] private GitHub repo
- [ ] deploy URL
- [ ] access granted to `recruitments@trademarkia.com`
- [ ] demo video
- [ ] architecture and tradeoffs documented

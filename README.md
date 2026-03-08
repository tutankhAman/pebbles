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
- Formula scope will stay intentionally narrow even with HyperFormula.

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

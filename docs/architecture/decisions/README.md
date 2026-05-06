# Architecture Decision Records

Append-only log of load-bearing runtime architecture decisions. See `../../methodology/METHODOLOGY.md §ADR practice` for the template and conventions.

## Index

| # | Title | Status | Date | Layer |
|---|---|---|---|---|
| [001](001-enrichment-vs-feedonomics.md) | Enrichment vs. Feedonomics | Accepted | _see file_ | engine |
| [002](002-streaming-layout-generation.md) | Streaming layout generation | Accepted | _see file_ | engine |
| [003](003-prerender-vs-cache-warming.md) | Prerender vs. cache warming | Accepted | _see file_ | engine |
| [004](004-vocabulary-constraint-invariant.md) | Vocabulary-constraint invariant | Accepted | _see file_ | engine |
| [005](005-storefront-vs-content-modes.md) | Storefront vs. content modes | Accepted | _see file_ | engine + foundation |
| [006](006-surface-typed-schemas.md) | Surface-typed schemas (split LayoutSchema → 6) | Accepted | 2026-04-30 | engine |
| [007](007-section-authoring-model.md) | Section authoring model (named insertion zones with typed contract) | Accepted | 2026-04-30 | foundation + admin + cross-layer |
| [008](008-tag-as-retrieval-signal.md) | Semantic tags as a first-class retrieval signal | Accepted | 2026-05-01 | engine + foundation + cross-layer |
| [010](010-cloudflare-parallel-deploy.md) | Cloudflare Workers + AI Gateway as parallel deploy target | Accepted | 2026-05-05 | foundation + engine |

## Pending (drafts)

- ADR-009 — Three-layer architecture commitment — _drafts alongside future NORTH-STAR refinement; mostly fulfilled by NORTH-STAR v0.4 already_

## Conventions

- **One file per ADR.** Filename: `NNN-kebab-title.md` (3-digit zero-padded).
- **Append-only.** Never edit a decided ADR. To change, write a new ADR with `Status: Supersedes ADR-NNN`.
- **Cite trace IDs.** Every ADR names the PRD/BRD trace IDs it affects.
- **Layer-tagged.** Every ADR names which layer(s) it impacts: engine / foundation / admin / cross-layer.

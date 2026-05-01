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

## Pending (drafts)

- ADR-006 — Surface-typed schemas (split single LayoutSchema into 6) — _drafts in Task #45_
- ADR-007 — Three-layer architecture commitment — _drafts in Task #42 alongside NORTH-STAR_

## Conventions

- **One file per ADR.** Filename: `NNN-kebab-title.md` (3-digit zero-padded).
- **Append-only.** Never edit a decided ADR. To change, write a new ADR with `Status: Supersedes ADR-NNN`.
- **Cite trace IDs.** Every ADR names the PRD/BRD trace IDs it affects.
- **Layer-tagged.** Every ADR names which layer(s) it impacts: engine / foundation / admin / cross-layer.

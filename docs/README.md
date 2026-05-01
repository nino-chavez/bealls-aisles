# Aisles Documentation Map

This is the entry point. Read it first.

## Canonical state (in precedence order)

| # | Doc | What it answers |
|---|---|---|
| 1 | [strategic/NORTH-STAR.md](./strategic/NORTH-STAR.md) | Where is Aisles going? |
| 2 | [strategic/STRATEGY.md](./strategic/STRATEGY.md) | Why this shape; what's out of scope |
| 3 | [functional/PRD.md](./functional/PRD.md) | Product requirements |
| 4 | [functional/BRD.md](./functional/BRD.md) | User stories with trace IDs |
| 5 | [architecture/ARCHITECTURE.md](./architecture/ARCHITECTURE.md) | Capability-level architecture |
| 6 | [methodology/METHODOLOGY.md](./methodology/METHODOLOGY.md) | How we work in this repo |
| 7 | [functional/PRD-COMPANION.md](./functional/PRD-COMPANION.md) | Design-time decisions with rationale |
| 8 | [architecture/decisions/](./architecture/decisions/) | ADRs (runtime architecture decisions) |
| 9 | [functional/BRD-OPEN-QUESTIONS.md](./functional/BRD-OPEN-QUESTIONS.md) | Known open items |
| 10 | [strategic/risks.md](./strategic/risks.md) | Load-bearing strategic bets and fallback paths |
| 11 | [../traceability.json](../traceability.json) | Trace-ID registry |

## By audience

- **Leadership / product** — start at [NORTH-STAR](./strategic/NORTH-STAR.md), then [STRATEGY](./strategic/STRATEGY.md), then [PRD](./functional/PRD.md). Skim [risks](./strategic/risks.md).
- **Engineers** — start at [ARCHITECTURE](./architecture/ARCHITECTURE.md), then ADRs in [architecture/decisions/](./architecture/decisions/), then layer-specific docs.
- **Designers / merchandisers** — [composition-taxonomy](./architecture/engine/composition-taxonomy.md) for the block vocabulary; [signals-business-guide](./strategic/signals-business-guide.md) for the persona model in business terms.
- **Developers (extending Aisles)** — [developer/](./developer/) for setup and API reference.
- **Demo prep** — [strategic/demos/](./strategic/demos/) for active demo collateral.

## By layer

The three layers (engine / foundation / admin) of [the architecture](./architecture/ARCHITECTURE.md) split as follows:

### Engine

- [architecture/engine/composition-taxonomy.md](./architecture/engine/composition-taxonomy.md) — block catalog × surface matrix × latitude rules
- [architecture/engine/signals-and-inference.md](./architecture/engine/signals-and-inference.md) — persona inference
- [architecture/engine/fractal-interface-evaluation.md](./architecture/engine/fractal-interface-evaluation.md) — composition philosophy
- [research/engine/](./research/engine/) — cross-industry research (Dynamic Yield, Monetate, etc.) — _populates after Task #43_

### Foundation

- [architecture/multi-brand.md](./architecture/multi-brand.md) — brand isolation
- [research/foundation/](./research/foundation/) — reference platforms (Stencil, Dawn, etc.) — _populates after Task #43_

### Admin

- [functional/specs/aisles-admin.md](./functional/specs/aisles-admin.md) — admin spec
- [research/admin/](./research/admin/) — merchant control planes — _populates after Task #43_

## Engagement / time-bound

- [strategic/engagements/bealls.md](./strategic/engagements/bealls.md) — Bealls demo engagement plan
- [strategic/demos/](./strategic/demos/) — demo prep collateral
- [audits/](./audits/) — verification artifacts (screenshots, before/after comparisons)

## Doc structure conventions

See [methodology/METHODOLOGY.md](./methodology/METHODOLOGY.md) for the seven-layer audience model, ADR practice, trace-ID format, and BigBlueprint workflow alignment.

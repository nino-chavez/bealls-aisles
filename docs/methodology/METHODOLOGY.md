# Aisles Methodology

How we do work in this repo. Borrowed from Atelier with Aisles-specific adjustments. Read this before contributing.

---

## Canonical state precedence

When canonical documents disagree, the precedence order is:

1. `docs/strategic/NORTH-STAR.md` — complete design scope
2. `docs/strategic/STRATEGY.md` — why this shape, what's out of scope
3. `docs/functional/PRD.md` — product requirements
4. `docs/functional/BRD.md` — stories with trace IDs
5. `docs/architecture/ARCHITECTURE.md` — capability-level architecture
6. `docs/methodology/METHODOLOGY.md` — this file (repo conventions)
7. `docs/functional/PRD-COMPANION.md` — design-time decisions with rationale
8. `docs/architecture/decisions/` — append-only runtime architecture decision log (ADRs)
9. `docs/functional/BRD-OPEN-QUESTIONS.md` — known open items
10. `docs/strategic/risks.md` — load-bearing strategic bets and fallback paths
11. `traceability.json` — trace-ID registry

If a change would alter canonical state, name which doc and why **before** modifying.

---

## The three-layer architecture

Aisles is three layers. Every contribution names which layer it touches:

1. **Engine** (`docs/architecture/engine/`, `src/lib/server/layout*`, `src/lib/schema/`, `src/lib/signals/`) — AI composition.
2. **Foundation** (`docs/architecture/foundation/`, `src/routes/`, `src/lib/components/cart`, `src/lib/components/checkout`, `src/lib/server/catalog.ts`) — table-stakes ecomm.
3. **Admin** (`docs/architecture/admin/`, separate `aisles-admin` repo) — merchant control plane.

Conflating the layers is the failure mode this repo is shaped to avoid. PRs that span layers must explicitly name the cross-layer contract.

---

## Stakeholders & audience

Primary audience for strategic and functional docs: **commerce.com internal teams — product, engineering, customer success.** Aisles is a possibility-prototype experiment, not a productization commitment. Each audience extracts different value from the same artifact (see NORTH-STAR §1).

Lead docs with **what each audience learns**, not with merchant value or competitive positioning. Productization conversations come later if the experiment surfaces evidence to support them.

Example merchant artifact: **Bealls** (and family — Bealls Florida + Home Centric). Concrete, real, off-price retail with BOPIS, family-of-brands cross-banner nav, Bealls Bucks loyalty, comparable-value pricing, and a content-only sister brand. Bealls grounds the artifact concretely; the engagement produces what our teams react to. Use Bealls properties to ground every example, but watch for Bealls-specific overfitting (RISK-08).

---

## Audience layering (seven-layer doc model)

Borrowed from claude-docs-toolkit / Atelier:

| Layer | Audience | Question they answer |
|---|---|---|
| **strategic** | Leadership | Where is Aisles going, and why this shape? |
| **functional** | Product, design, eng leadership | What does the product do? |
| **architecture** | Engineers, technical leadership | How is it designed? |
| **methodology** | Contributors | How do we work? |
| **developer** | Contributors, integrators | How do I extend or run it? |
| **research** | Anyone | What did we learn from the field? |
| **audits** | Operators | What did we verify, and when? |

Atelier's `ops/`, `testing/`, `user/` layers populate later (post-V1). Atelier's `protocol/` layer doesn't apply here — Aisles isn't an interop spec.

---

## ADR practice

Every load-bearing **runtime** architecture decision gets an ADR in `docs/architecture/decisions/NNN-title.md`. ADRs are append-only — supersede, never edit.

ADR template:

```markdown
# ADR NNN: <Title>

Status: Proposed | Accepted | Superseded by NNN | Deprecated
Date: YYYY-MM-DD
Deciders: <names>

## Context
<the situation, constraints, signals>

## Decision
<what we chose>

## Alternatives considered
- Option A — pros/cons
- Option B — pros/cons

## Consequences
- Positive
- Negative
- Reversibility cost

## Trace IDs
- PRD-XXX-NNN
- BRD-XXX-NNN
```

PRD-COMPANION captures **design-time** product decisions. ADRs capture **runtime** architecture decisions. Don't conflate.

---

## Trace IDs

Every PRD requirement gets a trace ID. Format: `PRD-<LAYER>-<NNN>`, e.g., `PRD-ENG-003` (engine), `PRD-FND-012` (foundation), `PRD-ADM-005` (admin), `PRD-XLAYER-002` (cross-layer).

BRD stories cite the trace IDs they fulfill: `Trace IDs: [PRD-ENG-003, PRD-ADM-001]`.

ADRs cite the trace IDs they affect.

`traceability.json` is the registry.

---

## Workflow alignment

The work pipeline (when we're producing new feature surfaces) follows BigBlueprint:

1. **Research** — `docs/research/<layer>/` — cross-industry pattern catalog.
2. **Design Principles** — `docs/architecture/<layer>/` — what the system can/can't do.
3. **Prototype** — code in `src/`. Prototype tests the design decisions.
4. **Fact-check** — verify against real codebases (aisles-admin, real merchant sites).
5. **Documents** — PRD/BRD entries get trace IDs and cite research + ADRs.
6. **Deploy** — Vercel previews; production deploys are merchant-bound.
7. **Iterate** — stakeholder review; updates loop back to NORTH-STAR if scope shifts.

Prototype + documents are built **simultaneously**. Strategy panels in the prototype connect each design decision back to its rationale.

---

## When in doubt

- If a doc disagrees with code, the doc is wrong unless it's the canonical state — ADR/PRD-COMPANION the discrepancy and resolve.
- If two layers tangle, surface the cross-layer contract in PRD-COMPANION before merging.
- If a research finding contradicts a previous decision, ADR the supersession.
- If a stakeholder request would expand scope, NORTH-STAR + STRATEGY take precedence — escalate before promising.

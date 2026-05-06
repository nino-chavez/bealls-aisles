# Agent Charter — Aisles (Bealls fork)

This file shapes how AI agents (Claude Code, others) operate in this repository.

---

## Project framing

Aisles is a **three-layer possibility prototype** — an experiment that unlocks the art of the possible for commerce.com internal teams. It is **not** a product being sold to merchants. It is an artifact our internal teams react to and extract capabilities from.

Three internal audiences, three different value extractions from the same artifact:

1. **Product teams** — "what merchant-facing capabilities does this surface that we should adopt?"
2. **Engineering teams** — "what architectural patterns and tech bets are validated? what's worth copying?"
3. **Customer success teams** — "what new merchant conversations does this enable? what objections does it expose?"

**Bealls** (Bealls + Bealls Florida + Home Centric) is the example merchant. Real merchant properties (off-price, family-of-brands, BOPIS, content-mode HC) ground the artifact concretely. The engagement produces the artifact our teams react to — it is not a merchant deal.

The three architectural layers (vectors of possibility, not sellable SKUs):

1. **Aisles engine** — AI composition (block catalog, prompts, schemas, latitude rules)
2. **Ecomm app foundation** — table-stakes commerce primitives (catalog, cart, checkout, account, search, locator)
3. **Aisles-admin control plane** — merchant override / config / observability (separate `aisles-admin` repo)

Conflating these layers is the project's known failure mode. Always name which layer a contribution touches.

---

## Canonical state precedence

When canonical documents disagree, this is the precedence order. If you would change canonical state, name which doc and why **before** modifying.

1. `docs/strategic/NORTH-STAR.md`
2. `docs/strategic/STRATEGY.md`
3. `docs/functional/PRD.md`
4. `docs/functional/BRD.md`
5. `docs/architecture/ARCHITECTURE.md`
6. `docs/methodology/METHODOLOGY.md`
7. `docs/functional/PRD-COMPANION.md`
8. `docs/architecture/decisions/` (ADRs)
9. `docs/functional/BRD-OPEN-QUESTIONS.md`
10. `docs/strategic/risks.md`
11. `docs/strategic/exit-criteria.md`
12. `traceability.json`

---

## Session-start checklist

1. Read `docs/README.md` (the document map).
2. Read `docs/strategic/NORTH-STAR.md` (where this is going).
3. Skim `docs/architecture/decisions/README.md` (load-bearing choices already made).
4. Check `docs/functional/BRD-OPEN-QUESTIONS.md` (you may be working on one).
5. If touching the engine: read `docs/architecture/engine/composition-taxonomy.md`.
6. If touching admin: read `docs/functional/specs/aisles-admin.md` and remember the admin lives in a separate repo.

---

## When proposing changes

- Name the layer(s) touched (engine / foundation / admin / cross-layer).
- For new components or surfaces, justify with a row in `composition-taxonomy.md`.
- For runtime architecture decisions, draft an ADR in `docs/architecture/decisions/`.
- For product decisions with non-obvious rationale, append to `PRD-COMPANION.md`.
- For requirement changes, update `traceability.json` and the relevant PRD/BRD entries.

---

## Methodology references

- [Atelier](~/Workspace/dev/wip/atelier) — supplies the canonical-state structure, ADR practice, and seven-layer doc audience model.
- [BigBlueprint](~/Workspace/dev/wip/big-blueprint) — supplies the work pipeline (Research → Principles → Prototype → Fact-check → Documents → Deploy → Iterate). Prototype + documents are built **simultaneously**.

See `docs/methodology/METHODOLOGY.md` for full conventions.

---

## Repository specifics

- Working dir: `/Users/nino/Workspace/dev/wip/bealls-aisles`. The parent `aisles-storefront` is the upstream multi-brand demo (Haven/Volt/Ember) — different repo, different work.
- **Two parallel deploy targets** (per ADR-010):
  - **Vercel** (production demos, off `main`): `aisles-demo-1` (Bealls), `aisles-demo-2` (Bealls Florida), `aisles-demo-3` (Home Centric). Aliases: `aisles-demo-{N}-signal-x-studio-labs.vercel.app`.
  - **Cloudflare Workers** (off the working branch, currently `worktree-spike-cloudflare-portkey`): same three brands on `*-cf.internal.signal-x.dev` internal domains via Wrangler envs. AI calls route through three Cloudflare AI Gateways (`aisles-bealls`, `aisles-bealls-fl`, `aisles-hc`).
- Brand selected via `BRAND_ID` env var (set in Vercel env or Wrangler `[env.*].vars`).
- Stack: SvelteKit 2 / Svelte 5 (runes) / Tailwind v4 / `ai` v6 + `@ai-sdk/anthropic` (routed through Vercel AI Gateway or Cloudflare AI Gateway depending on target) / BigCommerce GraphQL Storefront / Neon Postgres (enrichment) / Upstash Redis (layout cache).
- AI gateway selection: env-flag seam in `src/lib/server/ai-model.ts` (`useCfAig` / `useVercelGateway`). See `docs/operations/deployment-domains.md` and `docs/operations/deployment-log.md`.

---

## Default tone

No emoji unless explicitly requested. Terse responses; no trailing summaries unless asked. Edit existing files over creating new ones. Don't over-engineer — minimum complexity for the task at hand.

---

## Decision bias — default to action, not confirmation

When the next move is obvious from conversation, take it. Don't ask "continue or pause?", "want me to keep going?", or "should I think first or implement?" — those break flow without buying anything. A one-line status sentence ("continuing on X — will flag if I hit a real fork") beats a confirmation question.

Still confirm for: destructive/irreversible actions (force-push, branch/table deletion, `rm -rf`, dropping data, amending published commits, modifying CI/CD), forks where picking wrong wastes >30 min, genuinely ambiguous requests, and material scope expansion beyond what was authorized.

This rule applies to subagents, slash commands, and skill invocations launched from this repo too — they should not insert their own confirmation prompts on top of an already-authorized direction. Full version in `~/.claude/CLAUDE.md`.

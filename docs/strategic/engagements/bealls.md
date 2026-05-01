# Bealls Engagement — Plan, Scope, and Retro

**Engagement**: Three Bealls banners running on Aisles (agentic storefronts demo)
**Banners**: `bealls.com`, `beallsflorida.com`, `homecentric.com`
**Repo**: `bealls-aisles` (fork of `aisles-storefront` at commit `e6a4c37`)
**Created**: 2026-04-30
**Owner**: Nino Chavez

---

## Purpose of this document

Two purposes, one document:

1. **Plan** — what we believe needs to happen, broken into phases, with effort estimates that we commit to before any code is written.
2. **Retro** — at the end of the engagement, fill in the **Actual** column. The delta between estimated and actual is the headline number for the platform pitch: *"Aisles took us from a real merchant's three live sites to three working agentic demos in N days."* Without this baseline, that claim is vibes.

**Discipline rule**: do not edit estimates after work begins. Add notes, but the original numbers stay frozen so the retro is honest.

---

## Methodology: dual baseline

Estimates are tracked in two columns:

- **Human baseline** — what this engagement would cost one engineer working in an editor without agentic assistance. This is the *counterfactual cost*, the number a buyer would have paid the old way. Frozen at plan time.
- **Agent-assisted target** — working hypothesis for what the same engagement costs when coding agents do the bulk of the mechanical work (schema entries, scaffolding, API integration, prompt vocabulary, scrapers) under engineer supervision. Frozen at plan time.

Both baselines stay frozen; the retro fills in **Actual** alongside them. This produces three retro narratives, all useful:

1. *Actual beats agent target* → agents exceeded the compression hypothesis. Bigger pitch.
2. *Actual matches agent target* → ~3× speedup, as predicted. Validates the platform claim.
3. *Actual misses agent target* → supervision and judgment costs were real. Honest data for future engagements.

Re-baselining to the agent target after work starts erases narratives (1) and (3). Don't do it.

**Compression hypothesis** (what does and does not compress):

| Compresses well (70–90%) | Compresses partially (30–50%) | Doesn't compress |
|---|---|---|
| Schema/Zod entries | Catalog scraping (rate limits, anti-bot unknowns) | Strategic positioning calls |
| Renderer scaffolding | Vercel/dashboard config | Demo-moment choreography |
| Dispatch wiring | Enrichment runs (LLM API throughput is the bottleneck) | Audit judgment (what's load-bearing) |
| BC API integration | Prompt routing iteration (requires real AI eval) | Anti-bot debugging |
| Per-banner cloning of completed work | | LLM wall-clock time |

---

## Executive summary

The Aisles platform is already designed for this. The signal pipeline, persona inference engine, AI layout generation, refinement chat, observe dashboard, multi-brand router, and BC integration are brand-agnostic and ship today. Adding a banner is a config-only operation in `src/lib/brand/config.ts` plus a BC channel and a seeded catalog.

The actual work is everything that is unavoidably Bealls-specific: capturing each banner's brand identity, scraping a representative catalog, and extending the AI's component vocabulary so the generated layouts actually look like a department store rather than a DTC pure-play.

**Estimated total effort**:
- **Human baseline**: 14.5–16.5 working days for all three banners
- **Agent-assisted target**: 6–7 working days for the same scope

---

## Platform baseline (what we get for free)

These exist on `main` and require zero engagement-specific work:

| Capability | Location |
|---|---|
| Multi-brand router (`BRAND_ID` → `getBrand()`) | `src/lib/brand/config.ts` |
| Persona inference engine (4 personas, 15+ rules) | `src/lib/signals/inference.ts` |
| AI layout generation (Haiku → Sonnet fallback) | `src/routes/api/layout/+server.ts` |
| Schema-constrained AI output (the V invariant) | `src/lib/schema/layout.ts` |
| Cross-session signal store (Redis + in-memory) | `src/lib/signals/store.ts` |
| Refinement chat | `src/lib/components/RefinementChat.svelte` |
| Cart drawer + BC cart API | `src/routes/api/cart/+server.ts` |
| Observe dashboard (signals, inference, generation log) | `src/routes/observe/` |
| BC GraphQL Storefront integration | `src/lib/server/bigcommerce.ts` |
| Enrichment pipeline (persona-fit scoring, embeddings) | `src/lib/server/enrichment/enrich.ts` |
| Layout cache (Upstash Redis, 1hr TTL) | `src/lib/server/cache.ts` |
| Catalog seed scaffold (BC v3 API) | `scripts/setup-catalog.mjs` |

Three reference brands ship in the repo (`haven`, `volt`, `ember`) demonstrating different verticals, color systems, voice profiles, and persona definitions. Bealls's three banners follow the same shape.

---

## Engagement scope (what's banner-specific)

### Phase 1 — Site audit and component inventory (~½ day)

**Goal**: capture, with screenshots, the actual UI patterns each Bealls banner uses, so the component vocabulary expansion is grounded in evidence rather than assumption.

**Deliverable**: `docs/audits/{banner}.md` per banner — annotated screenshots of homepage, one PLP, one PDP, with component callouts.

**Why this comes first**: every estimate downstream depends on what we find here. If `beallsflorida.com` does something we didn't anticipate (e.g., interactive size availability dots), the component scope shifts.

### Phase 1 audit findings (added 2026-04-30 — does not modify frozen estimates)

Phase 1 was completed agent-assisted. Three banner audits and a synthesis are at:

- `docs/audits/bealls.md`
- `docs/audits/beallsflorida.md`
- `docs/audits/homecentric.md`
- `docs/audits/SYNTHESIS.md`

**Key findings that affect Phase 2 onward**:

1. **HomeCentric is brick-and-mortar only** — no live e-commerce. Demo strategy locks to **synthesize an online HomeCentric using a curated home-category subset of `bealls.com`'s catalog**, branded with HomeCentric identity. This is the engagement's strongest sales pitch: *"Your offline brand can be online in days."*
2. **Component scope adjustment** (deltas captured here; frozen Phase 2 estimate does not move):
   - **Add `product-carousel`** to Tier 1 (Best Sellers + Customers Also Purchased patterns appear on 2 of 3 banners)
   - **Add `coupon-strip`** to Tier 1 (personalized yellow coupon banner on beallsflorida PDP — distinct from persistent `promo-strip`)
   - **Add `lifestyle-price-hero`** to Tier 2 (bealls.com only — large image with bold price overlay)
   - **Rename `editorial-lookbook` → `editorial-hero`** and simplify to text-overlay only (saves ~1 day vs the planned hotspot-interactive version)
   - **Schema extensions** (cheap, no new components): `category-header` adds `heroImage` + `subcategories[]`; `product-grid`/`product-carousel` add `showRating` + multi-badge; `category-tile-grid` adds `description` + column variants 2–5
3. **Net effect on Phase 2**: revised effort is **5.6 d human / 1.8 d agent-assisted** vs frozen **5.0 d / 1.5 d**. Delta is **+0.6 d / +0.3 d**. Per discipline, the frozen number does not move — this delta is tracked for the retro under "What we added that wasn't in the plan."

**Stakeholder decisions logged 2026-04-30 (Q&A from synthesis open questions)**:

1. **Legal sign-off** — not required. Proceed with scraping all three banners' content for the demo. Demo URL still gated (`noindex` / password-gated) as engineering hygiene.
2. **HomeCentric strategy** — *revised from "synthesize online" to "content-mode platform capability"* — see below.
3. **Per-card star ratings** — locked into the demo. Schema extends `product-grid` and `product-carousel` with `showRating: boolean`; product summary gains `rating: number | null` and `reviewCount: number`. Synthetic ratings seeded during Phase 5 enrichment (range 4.0–4.8, review counts 5–500, weighted by persona-fit so high-fit products skew higher).

**HomeCentric strategy: content-mode platform capability** (supersedes the synthesize-online approach in the original audit synthesis):

Rather than synthesizing an e-commerce HomeCentric (which required hedging "this is a capability demo, not a prescription"), the engagement demonstrates that **Aisles supports two operating modes from a single platform**:

| Mode | Banners | Personalization drives | CTA destinations |
|---|---|---|---|
| **Storefront** | bealls.com, beallsflorida.com | Product selection, pricing, cross-sell | Cart, PDP, checkout |
| **Content / locator** | homecentric.com | Editorial framing, hero choice, category emphasis, lifestyle imagery | Store locator, newsletter, in-store-pickup interest |

Same persona inference engine, same layout AI, same brand-config router — different downstream actions. **The demo pitch becomes**: "One platform, two operating models, zero compromise on personalization in either."

This dissolves the operational-restrictions caveat entirely (no implied fulfillment HomeCentric may not have) and matches HomeCentric's real posture. It also unlocks a cross-banner persona-continuity demo: a *gatherer* on `homecentric.com` browses bedroom inspiration → switches to `bealls.com` via brand strip → sees bedding products on sale, same persona maintained. The engine is identical.

**Net effort delta vs the synthesize-online approach**: roughly net-neutral (~+0.4 d human / +0.1 d agent). The HomeCentric catalog scrape (~1 day saved) is replaced by platform mode capability (~1.4 d added: mode flag, mode-aware schema, content-mode CTA routing, curated content items model). **The mode flag is a permanent platform capability**, reusable beyond this engagement. ADR: `docs/architecture/decisions/005-storefront-vs-content-modes.md`.

**Phase 1 actuals** (preliminary, agent-assisted):

| | Frozen | Actual |
|---|---|---|
| Human baseline estimate | 0.5 d | (would have been ~0.5 d) |
| Agent-assisted target | 0.25 d (~2 hr) | **~1 hr elapsed** (Playwright captures + 4 markdown docs) |

Actual came in faster than agent target — to be confirmed once retro tabulates final time including review.

### Phase 2 — Component vocabulary expansion (~5 days)

**Goal**: expand the AI's compositional vocabulary from 4 components (DTC editorial) to ~9 components (department-store + promo-driven).

The current vocabulary (`editorial-header`, `hero-product`, `product-grid`, `category-header`) cannot represent Bealls's promo-density, sub-category tiles, or savings-tier merchandising. The AI will produce layouts that look like Haven with different colors — which undercuts the platform's core claim that *the AI matches the brand*.

**Each new component touches 4 files** (the unit cost):

1. `src/lib/schema/layout.ts` — Zod schema entry (~30 LOC)
2. `src/lib/components/layouts/sections/<Name>.svelte` — renderer (~80–150 LOC)
3. `src/lib/components/layouts/LayoutRenderer.svelte` — dispatch branch (~5 LOC)
4. `src/lib/server/layout-prompt.ts` — `COMPONENT_GUIDE` entry with persona-routing rules (~10–20 lines of prose)

Plus a static-fallback fixture and a unit test.

**Per-component baseline**: ½ day for static visuals; 1–1.5 days for interactive state.

#### Tier 1 — required for the demo to feel like Bealls (3 components, ~3 days)

| Component | Purpose | Persona routing |
|---|---|---|
| `promo-strip` | Doorbusters, Bealls Bucks earn windows, % off coupon callouts. | Hunter-heavy, gifter-medium, gatherer-light, researcher-skip |
| `category-tile-grid` | Visual category nav with photographic tiles ("Tops", "Bottoms"; "Bedroom", "Bath"). | All personas — gatherer wants visual exploration; hunter wants fast nav |
| `price-rail` | Strikethrough + savings %, "Under $20", "Up to 60% off" — the off-price merchandising signal. | Hunter primary, gifter for "under $X" framing |

#### Tier 2 — makes one banner shine, justifies the platform claim (2 components, ~2 days)

| Component | Purpose | Persona routing |
|---|---|---|
| `editorial-lookbook` | Florida lifestyle / resort wear scenes (multi-product styled compositions). | Gatherer primary, gifter secondary — primarily for `beallsflorida.com` |
| `bealls-bucks-callout` | Loyalty earning preview at PLP/PDP — "Earn $10 Bealls Bucks on this order." | Always-show for known shoppers; hunter + gifter benefit most |

#### Tier 3 — deferred (probably skip for v1 demo)

| Component | Defer reason |
|---|---|
| `clearance-rail` (separate from `price-rail`) | Use `price-rail` with a "Clearance" tier label first; only build a separate component if the merchandising story diverges. |
| `swatch-grid` (color/size variants on PLP) | High render complexity (interactive state + BC variant API). Tag as known limitation. |
| `comparison-table` | Researcher-heavy, but Bealls shoppers don't comparison-shop dresses. Save for a later vertical. |

**Buffer**: ~1 day for prompt iteration (writing routing rules per persona × per banner voice) and ~1 day for the static-fallback cascade and tests.

### Phase 3 — Brand identity capture, per banner (~1 day each, 3 days total)

For each of the three banners:

| Banner | Voice angle | Persona angle |
|---|---|---|
| `bealls.com` | FL coastal value, promo-heavy, family-oriented | Gatherer = vacation outfits; hunter = restocking on coupon; gifter = snowbird grandparents |
| `beallsflorida.com` | Resort wear, beach lifestyle, slightly more aspirational | Gatherer = resort/beach inspiration; hunter = outfit completion; gifter = gift shopping for the FL recipient |
| `homecentric.com` | Off-price home, closeout-driven | Closer to Haven, but with off-price/closeout angle in voice |

**Per banner deliverable**:
- `brands/{banner}.json` (brand identity spec — colors, typography, voice attributes, anti-patterns)
- Entry in `src/lib/brand/config.ts` (runtime config — categories, theme tokens, persona definitions, prompt voice guidance)
- BC channel ID provisioned and storefront token generated

**Tools**: use `~/Workspace/dev/tools/forge-brand` for token generation from the brand JSON.

### Phase 4 — Catalog scrape and BC seed (~3–4 days, ~1 day per banner + 1 day shared scraper)

**Per banner target**: ~80–150 products across 6–8 categories. Enough that layouts feel real and persona sorting has signal.

**Scrape pipeline**:
1. Build a Playwright scraper (Playwright is already a project dep) that hits each banner's PLP HTML and extracts: title, regular price, sale price, primary image, breadcrumb category, short description, brand, key facets.
2. Normalize into a common JSON shape per banner.
3. Per-banner `scripts/seed-bealls-{banner}.mjs` that creates a BC channel + categories + products via the existing v3 API pattern in `setup-catalog.mjs`.

**Legal**: this is a demo for *this specific merchant*, so scraping their own catalog is defensible under sales-engineering norms — but get explicit sign-off in the engagement before any screenshots leave a deck. Demo URL must be password-gated or `noindex` until consent is confirmed.

### Phase 5 — Enrichment + persona calibration (~1 day per banner, mostly unattended)

Run the existing enrichment pipeline against each new BC channel. Sonnet generates persona-fit scores and semantic tags using the persona definitions written in Phase 3, so quality of Phase 3 work directly determines layout quality here.

**Effort is wall-clock, not engineer time**: enrichment runs ~30–60 minutes per channel of 100–150 products. Engineer time is ~½ day setup + spot-check + re-runs if persona definitions need tuning.

### Phase 6 — Three Vercel projects + envs (~½ day)

Same git repo, three Vercel projects, three sets of env vars (`BRAND_ID`, `BC_CHANNEL_ID`, `STOREFRONT_TOKEN`, shared Redis + Neon). Already documented in `docs/architecture/multi-brand.md`.

### Phase 7 — Demo polish (~1–2 days)

- Updated demo script with Bealls-specific persona-shift moments (one per banner).
- Cache-warm script entries for all three banners (so live demo never cold-starts).
- Observe dashboard screenshots for the deck.
- One scripted URL-param sequence per banner that produces a clean persona-shift moment on stage.

---

## Estimate summary

| Phase | Human baseline | Agent-assisted target | Compression | What doesn't compress in this phase |
|---|---|---|---|---|
| 1. Site audit | 0.5 d | ~2 hr (~0.25 d) | ~50% | Judgment about what's load-bearing vs decorative |
| 2. Component vocabulary expansion (Tier 1+2) | 5 d | ~1.5 d | ~70% | Prompt routing iteration (needs real AI output evaluation) |
| 3. Brand identity (3 banners) | 3 d | ~1 d | ~70% | Strategic positioning (which voice is *right*) |
| 4. Catalog scrape + BC seed | 3–4 d | ~1.5–2 d | ~50% | Anti-bot countermeasures, image hosting decisions, rate limits |
| 5. Enrichment + persona calibration | 1.5 d | ~1 d | ~30% | LLM API throughput, not engineer time |
| 6. Vercel projects + envs | 0.5 d | ~0.25 d | ~50% | Dashboard clicks unless fully CLI/MCP-driven |
| 7. Demo polish | 1–2 d | ~0.5–1 d | ~50% | Choosing the moment that lands on stage |
| **Total** | **14.5–16.5 d** | **~6–7 d** | **~60%** | |

**Human baseline assumes**: one engineer, sequential, no agentic assistance. With 1-engineer parallelism cap, sequential = wall-clock; with careful sequencing (audit gates everything; component work parallel to brand-identity capture once audit is done), wall-clock can compress to **~12 days**.

**Agent-assisted target assumes**: coding agents (Claude Code or equivalent) do the bulk of mechanical work under engineer supervision. The engineer's time shifts from typing to reviewing, calibrating, and making judgment calls.

---

## Sequencing recommendation

1. **Phase 1 (audit) first.** Half a day. Output gates Phase 2 component scope.
2. **Pick `bealls.com` as the lead banner.** Most distinctive promo grammar = best demo of the AI's brand-voice adaptation. Build Phases 2–5 end-to-end on this one banner before forking the work for the other two.
3. **Clone forward to banner 2 and 3.** Components are reused; only brand JSON, BC channel, and catalog scrape differ. Per-banner marginal cost should drop from ~5 days to ~2.5 days after the lead.
4. **Phase 7 (demo polish) last.** Don't capture observe dashboard screenshots until layouts have stabilized, or you'll re-shoot.

---

## Risks and open decisions

| Risk / Decision | Impact | Mitigation / Resolution |
|---|---|---|
| Component vocabulary expansion is the schedule pivot. | If we keep the 4-component vocabulary, we ship in ~1 week but layouts look like Haven-with-different-colors, undercutting the platform claim. | Commit to Tier 1+2 (5 components) up front. |
| Catalog quality compounds. | A thin or noisy scrape produces uninspiring layouts no matter how good the AI is. | Budget time to clean titles/prices/images before enrichment runs. Spot-check 10 random products per banner before enrichment. |
| Legal exposure on scraped imagery. | Even for a sales demo, republishing a merchant's product imagery on a public URL is a gray area. | Password-gate or `noindex` all three demos until written consent. |
| `editorial-lookbook` rendering complexity. | Hotspot interactivity = 1.5 days; static composition = 0.5 day. | **Decision: static for v1.** Re-open if the demo lands and we want a v2. |
| `price-rail` carousel behavior. | Full carousel = 1 extra day vs. CSS overflow scroll. | **Decision: CSS overflow for v1 desktop demo.** Log carousel as a post-demo follow-up. |
| Persona definitions drift between Phase 3 and Phase 5. | Wrong definitions in Phase 3 means re-running enrichment in Phase 5. | Write definitions deliberately in Phase 3; spot-check first 10 enriched products before running the full channel. |

---

## Retro — fill in at end of engagement

Freeze estimates above. Fill in actuals here. Compute deltas. Note surprises.

### Actuals by phase

| Phase | Human baseline | Agent target | Actual | Δ vs human | Δ vs agent | Notes / surprises |
|---|---|---|---|---|---|---|
| 1. Site audit | 0.5 d | 0.25 d | _TBD_ | | | |
| 2. Component vocabulary expansion | 5 d | 1.5 d | _TBD_ | | | |
| 3. Brand identity (3 banners) | 3 d | 1 d | _TBD_ | | | |
| 4. Catalog scrape + BC seed | 3–4 d | 1.5–2 d | _TBD_ | | | |
| 5. Enrichment + persona calibration | 1.5 d | 1 d | _TBD_ | | | |
| 6. Vercel projects + envs | 0.5 d | 0.25 d | _TBD_ | | | |
| 7. Demo polish | 1–2 d | 0.5–1 d | _TBD_ | | | |
| **Total** | **14.5–16.5 d** | **6–7 d** | _TBD_ | | | |

### What was easier than expected

_TBD_

### What was harder than expected

_TBD_

### What we cut

_TBD_

### What we added that wasn't in the plan

_TBD_

### Per-banner marginal cost after the lead

| Banner | Marginal effort | Notes |
|---|---|---|
| `bealls.com` (lead) | _TBD_ | Lead banner — full path |
| `beallsflorida.com` | _TBD_ | Marginal cost after lead |
| `homecentric.com` | _TBD_ | Marginal cost after lead |

### Headline numbers for the platform pitch

- Total wall-clock days from blank fork to three live demos: _TBD_
- Speedup vs human baseline: _TBD_× (e.g., "15 days of engineer work compressed to 5")
- Speedup vs agent target hypothesis: _TBD_ (over / on / under)
- Lines of code added (excluding catalog data): _TBD_
- Net-new components added to the AI vocabulary: _TBD_
- Tokens of brand-specific config per banner: _TBD_
- Time from "add new banner" decision to demo-ready URL (banner 2 or 3): _TBD_

### Where compression beat the hypothesis

_TBD — phases where agents compressed faster than the agent-assisted target._

### Where compression underperformed the hypothesis

_TBD — phases where supervision, judgment, or wall-clock costs ate the savings. These are the most useful data points for future engagement scoping._

---

## Related docs

- `docs/architecture/ARCHITECTURE.md` — platform architecture, the V invariant, signal pipeline
- `docs/architecture/multi-brand.md` — adding a new brand (config, BC channel, Vercel project)
- `docs/architecture/decisions/004-vocabulary-constraint-invariant.md` — why the schema is the contract
- `docs/functional/specs/behavioral-signals.md` — signal pipeline expansion roadmap

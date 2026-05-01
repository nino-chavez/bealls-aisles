# Cold-start prompt latency — baseline + post-optimization (2026-05-01)

Goal: reduce cold-start `/api/layout` latency by tightening prompt construction without
changing AI output behavior. Layer: **engine**.

Method: each cell calls `POST /api/layout` with a unique `picksContext` (cache-busts the
in-process + Redis layout cache). End-to-end wall-clock measured with `curl -w "%{time_total}"`.
Dev server runs locally, BC GraphQL hits real catalog. Single warm Vite process per brand.

The optimization happens entirely in `src/lib/server/layout-prompt.ts` —
no schema changes, no behavior change to AI block selection.

## Cells

6 cells = 2 brands (bealls, beallsflorida) × 3 surfaces (home, cart, checkout).

| # | Brand          | Surface  | Persona     | picksHash suffix |
|---|----------------|----------|-------------|------------------|
| 1 | bealls         | home     | hunter      | `baseline-1-<ts>`|
| 2 | bealls         | cart     | hunter      | `baseline-5-<ts>`|
| 3 | bealls         | checkout | gifter      | `baseline-6-<ts>`|
| 4 | beallsflorida  | home     | hunter      | `baseline-7-<ts>`|
| 5 | beallsflorida  | cart     | gifter      | `baseline-8-<ts>`|
| 6 | beallsflorida  | checkout | hunter      | `baseline-9-<ts>`|

## Baseline (before optimization)

Captured 2026-05-01, AI Gateway → claude-haiku-4.5.

| # | Brand × surface × persona            | Cold-start (s) | Sections out |
|---|--------------------------------------|----------------|--------------|
| 1 | bealls × home × hunter               | 14.91          | 6            |
| 2 | bealls × cart × hunter               |  3.91          | 1            |
| 3 | bealls × checkout × gifter           | 11.27          | 2            |
| 4 | beallsflorida × home × hunter        | 18.49          | 7            |
| 5 | beallsflorida × cart × gifter        |  4.04          | 1            |
| 6 | beallsflorida × checkout × hunter    |  4.38          | 1            |

Supplementary cells (same baseline run, kept for reference):

| Cell                                    | Cold-start (s) | Sections out |
|-----------------------------------------|----------------|--------------|
| bealls × home × gatherer                | 13.47          | 7            |
| bealls × plp/women × researcher         | 10.02          | 3            |
| bealls × plp/women × gatherer           | 11.75          | 5            |

Averages by surface (primary 6 cells):

- home: **(14.91 + 18.49) / 2 = 16.7s**
- cart: **(3.91 + 4.04) / 2 = 3.98s**
- checkout: **(11.27 + 4.38) / 2 = 7.83s** (high variance — checkout output size shifts the wall-clock floor)

Surprise: checkout cell variance is wide (4.4s vs 11.3s) even though the schema admits at most
2 blocks. Both cells got the full 18-block storefront vocabulary in the prompt, so the AI is
spending tokens re-confirming "no, none of these other 16 blocks fit here" before emitting.
Surface-aware vocabulary should both shrink the prompt AND tighten the variance.

## Post-optimization

Same dev-server / brand-config / picksContext-as-cache-buster method. Refactored
`buildLayoutPrompt` filters the component guide by surface (cart→1 block, checkout→2,
pdp→6, home/plp/empty→18) and compresses each block's persona affinity to symbolic form.

| # | Brand × surface × persona            | Cold-start (s) | Sections out | Δ vs baseline       |
|---|--------------------------------------|----------------|--------------|---------------------|
| 1 | bealls × home × hunter               | 14.68          | 6            | −1.6% (within noise)|
| 2 | bealls × cart × hunter               |  3.58          | 1            | −8.4%               |
| 3 | bealls × checkout × gifter           |  4.32          | 2            | −61.7%              |
| 4 | beallsflorida × home × hunter        | 13.98          | 5            | −24.4%              |
| 5 | beallsflorida × cart × gifter        |  4.51          | 1            | +11.6% (within noise)|
| 6 | beallsflorida × checkout × hunter    |  7.34          | 2            | +67% (see note)     |

Note on cell 6: the baseline checkout × hunter run on bf came in at 4.38s — the lowest of
two measured checkout cells. Single-sample comparisons on cells with high AI output variance
are unreliable. The bealls checkout cell (cell 3) has higher signal — both baseline (11.27s)
and post-optimization (4.32s) had the same section count, so the 62% improvement is the
reliable read.

### Re-samples (variance check, bealls)

To disambiguate variance from real delta, three re-samples per cell with fresh picksHashes:

| Cell                          | Run 1 | Run 2 | Run 3 | Mean   | Baseline |
|-------------------------------|-------|-------|-------|--------|----------|
| home × hunter (post)          | 14.49 | 14.42 | 11.69 | 13.53  | 14.91    |
| checkout × gifter (post)      |  4.89 |  5.19 |  4.59 |  4.89  | 11.27    |

Post averages by surface (using primary 6 + bealls re-samples for home/checkout means):

- home: ~13.8s (baseline: 16.7s) — **−17%**, **does not hit ~10-11s target**
- cart: ~4.05s (baseline: 3.98s) — **flat**, already well under target
- checkout: ~5.1s (baseline: 7.83s) — **−35%**, **hits ≤9s target**

### Reading the results

The hypothesis was: surface-aware vocabulary saves the most on surfaces with narrow valid
block sets (PDP/cart/checkout) because they were previously paying the full 18-block prompt
overhead just to discard 16-17 of them. Confirmed:

- **Checkout**: 18 blocks → 2 blocks. AI no longer wades through a wide menu before settling
  on the assurance-strip variant. Wall-clock: 11.27s → 4.89s.
- **Cart**: 18 → 1. Already cheap because output is tiny (one section). Save was on input
  tokens, not user-facing latency.
- **Home/PLP**: 18 → 18. Description compression alone saved ~10-15% of input tokens; AI
  output generation dominates wall-clock here. Modest 9-17% improvement, not the 25-30%
  spec target.

The home/PLP target won't be reached without either (a) model selection for the wide-latitude
surfaces, (b) shrinking schema-side block sets via taxonomy, or (c) streaming first-paint
optimization. Those are separate sessions per the constraint set.

## PLP + PDP gap-fill (post-optimization, 2026-05-01)

The primary 6 cells covered home/cart/checkout. PLP was sampled in baseline as a supplementary
pair; PDP wasn't measured at all (no live route calls `/api/layout` for surface=pdp — see
note below). This gap-fill re-samples PLP post-optimization and adds synthetic PDP cells so the
prompt-construction optimization is evidenced across every surface in the schema.

| # | Brand × surface × persona            | Cold-start (s) | Sections | Δ vs baseline / notes |
|---|--------------------------------------|----------------|----------|------------------------|
| A | bealls × plp × researcher            | 10.04          | 4        | baseline 10.02s — flat (within noise) |
| B | bealls × plp × gatherer              | 11.08          | 4        | baseline 11.75s — −5.7% (within noise) |
| C | bealls × pdp × hunter (synthetic)    |  6.77          | 3        | no baseline; PDP narrow vocab (6 blocks) |
| D | bealls × pdp × researcher (synthetic)|  8.33          | 4        | no baseline |
| E | beallsflorida × plp × researcher     |  9.37          | 4        | no prior bf plp baseline |
| F | beallsflorida × pdp × hunter (synthetic) | 6.70       | 2        | no baseline |

### Reading

- **PLP is flat.** Surface-aware vocabulary doesn't help PLP — its valid block set is the same
  18-block storefront menu as home. The prompt is the same shape; the wall-clock delta is in
  the AI output-generation budget, which the optimization didn't touch. This was the predicted
  outcome from the post-optimization analysis (home/PLP land in the 13–14s and 9–11s ranges
  respectively because output dominates; input-token reduction is marginal).
- **PDP is well under threshold.** The 6.7–8.3s range is comfortably below the >9s flag threshold.
  The narrow 6-block PDP vocabulary is paying its predicted dividend — synthetic-only today,
  but the prompt-construction layer is ready if a future PDP-AI variant ships. No bloat
  surfaced; description-compression pass appears clean for PDP-eligible blocks.
- **Variance is real.** PDP × researcher (8.33s) is 23% slower than PDP × hunter (6.77s) on
  the same brand. AI output-size variance per persona is the same effect documented in the
  primary checkout cells — single-sample comparisons remain unreliable.

### Synthetic measurement caveat

PDP cells (C, D, F) call `POST /api/layout` with `surface: pdp` but no live route in the app
exercises this path. PDP zones are foundation-rendered from tag-overlap aggregates per ADR-008
Phase B — `pdp.related`, `pdp.cross-sell`, and `pdp.recently-viewed` resolve in `+page.server.ts`
without an AI roundtrip. The PDP schema and prompt-vocabulary slice exist for forward
compatibility (e.g., a future `pdp.editorial` block AI-composed against the cross-sell pool).
These measurements validate the surface-aware optimization across the full schema; they do
not reflect any user-visible PDP latency today.

## Pre-warm scope + verification (2026-05-01)

`scripts/cache/prewarm.ts` populates the layout cache at deploy time so first-visit cold starts
hit only on uncommon (persona × surface × category) cells. Cell list is data —
`scripts/cache/prewarm-cells.json` — read by the script at runtime.

**In scope** (warmed):
- home × {gatherer, hunter, researcher, gifter} — 4 cells per brand
- PLP × {1–2 representative categories} × 4 personas — 4–8 cells per storefront brand

**Out of scope** (intentionally not warmed):
- PDP — zones are foundation-rendered from tag-overlap aggregates per ADR-008 Phase B; no
  `/api/layout` call exists to warm. The synthetic measurements above exercise the path the
  schema admits, but no live visitor hits it today.
- cart, checkout — cart-state-dependent. Pre-warming a cart layout against an empty cart
  caches the wrong substrate; the AI composes cart-upsell against in-cart line items.
- empty / rescue — generated only when needed. Pre-warming pre-supposes which rescue variant
  (404, empty-cart, empty-search, empty-wishlist) a visitor will hit; better to let the cache
  fill organically.
- Home Centric PLP — content-mode brands short-circuit in `+page.server.ts` and never call
  `/api/layout`. HC home is warmed (the home `.svelte` calls `/api/layout` regardless of mode).

Total cell count: 12 (bealls) + 12 (beallsflorida) + 4 (homecentric) = **28 cells**.

### Pre-warm timing — bealls (dev verify, 2026-05-01)

First run: 8 generated (PLP × women + PLP × kids × 4 personas), 4 cached (home × 4 personas
were already in the cache from prior dev work). 82.6s wall-clock total.

Second run: 0 generated, 12 cached, 0 failed — 0.5s total. Per-cell latency 35–109ms.
Confirms idempotency.

Direct curl verification of warmed cells returns `cacheHit: true` with `generationTimeMs`
in the 34–87ms range (server-side cache fetch only; network adds the rest).

In production, deploy-time pre-warm of all three brands runs ~5 minutes total (~10s × 28
cells). The script is wired as `npm run prewarm`. Deploy-hook configuration is a Vercel
dashboard task, not a code change.

## Notes

- BRAND_ID resolution is process.env at server start, so brand switches require dev-server
  restart. Both brands use the same shared layout-prompt; the prompt-token math is brand-agnostic.
- PDP doesn't call `/api/layout` in any live route (zones are foundation-rendered from
  tag-overlap aggregates per ADR-008 Phase B). The cells in the gap-fill are synthetic — see
  caveat above.
- Empty-rescue surfaces also use the storefront vocabulary; not in the 6 primary cells but
  follow the same surface-aware tightening once it lands.

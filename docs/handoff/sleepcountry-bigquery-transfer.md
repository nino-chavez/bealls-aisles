# Handoff — Sleep Country BigQuery calibration and what it did to Aisles

**Written:** 2026-07-30
**For:** a fresh Claude Code session on another machine picking up this work
**Branch that carries everything:** `worktree-spike-cloudflare-portkey` (pushed to origin)
**Status of the work itself:** complete and committed, May 6–7 2026. Not merged to `main`.

This doc is self-contained. You can paste it into a new session as-is, or fetch the branch
and read it in place. If you only read one section, read **§5 Findings** — that is the
knowledge worth carrying; everything else is scaffolding for reproducing it.

---

## 1. Orientation — what Aisles is

Aisles is a three-layer possibility prototype for commerce.com internal teams. Not a
product sold to merchants; an artifact internal teams react to and extract capabilities
from. The layers:

1. **Aisles engine** — AI composition (block catalog, prompts, schemas, latitude rules),
   including a persona-inference engine that reads shopper signals and picks a layout.
2. **Ecomm app foundation** — catalog, cart, checkout, account, search, locator.
3. **Aisles-admin control plane** — merchant override / config / observability (separate repo).

Stack: SvelteKit 2 / Svelte 5 runes / Tailwind v4 / `ai` v6 + `@ai-sdk/anthropic` /
BigCommerce GraphQL Storefront / Neon Postgres / Upstash Redis. Deployed to both Vercel
and Cloudflare Workers (ADR-010), brand selected by `BRAND_ID` env var.

The engine infers one of four personas per session — **researcher / hunter / gatherer /
gifter** — from ~28 hand-tuned rules in `src/lib/signals/inference.ts`.

**The problem those 28 rules had:** they were authored against a mental model of off-price
apparel shopping, because the only brands were Bealls, Bealls Florida, and Home Centric.
Nobody had ever checked them against real shopper behavior, in any category.

## 2. What Sleep Country was for

Sleep Country (Canadian mattress retailer, sleepcountry.ca) entered as the **4th Aisles
brand** on 2026-05-06 — but the brand was the vehicle, not the point. The point was a
**7-week anonymized BigQuery extract of real Sleep Country session data**, which became the
first external ground truth the persona engine had ever been scored against.

Two questions it answered:

1. Do rules tuned for off-price apparel transfer to a different retail category?
2. Can real session data produce cold-start priors better than a uniform guess?

The answer to (1) is the interesting one and it is **partially, with three rules pointing
in the wrong direction**. See §5.

## 3. The data

**Provenance.** Sanitized BigQuery extract, delivered by the operator as CSVs into
`~/Downloads` (`sleepcountry_sanitized.csv`, `sleepcountry_sanitized_filtered.csv`, then a
revised `sleepcountry_sanitized_filtered (1).csv`), copied into the repo as
`data/sleepcountry-events.csv`.

**Shape.**

| Metric | Value |
|---|---|
| Event rows | 29,870 |
| Distinct sessions | 11,629 |
| Rows with session attribution | 28,623 (95.8%) |
| Mean events / session | 2.46 |
| Session length p50 / p75 / p90 / p99 / max | 1 / 2 / 5 / 17 / 211 |

**Referrer entry mix.** internal 57.9% · direct 17.6% · google 10.6% · dormezvous 7.3%
(sister brand) · facebook 4.1% · instagram 1.1% · youtube 0.2%.

**Four quirks that bound every conclusion** (full detail in
`docs/spikes/2026-05-05-cloudflare-portkey/sleepcountry-data-quirks.md`):

1. **Cart/checkout events are essentially all orphan.** `SHOPPER_CART_UPDATED` (728) and
   `SHOPPER_CHECKOUT_COMPLETED` (194) have zero session attribution. Only 510 sessions
   (4.4%) have any attributable cart event; 117 (1.0%) reach checkout. Every cart-dependent
   rule has thin support and every funnel-based heuristic is hard-capped.
2. **Half the sessions are bounces.** p50 = 1 event. Only the top ~10% (≥5 events) carry
   enough signal for a non-trivial heuristic.
3. **Schema is post-privacy-filter.** UTM columns dropped, device type absent, timestamps
   hour-bucketed (so no dwell measurement), postal prefix 78.6% empty across only two FSAs
   (L6T Mississauga ON, H9R Pointe-Claire QC).
4. **`internal` referrer dominates** and cannot be cleanly separated into
   "in-session continuation" vs "new session from an internal link" at hour granularity.
   Treat it as a first-class entry condition; do not collapse into `direct`.

**IMPORTANT — the raw data is gitignored.** `data/sleepcountry-events.csv` (3.0 MB) and
`data/sleepcountry-fingerprinted.jsonl` (2.6 MB) are **not** on the branch. They exist only
on the machine where the work was done. To rerun the analysis elsewhere you need the CSV
re-exported from BigQuery or copied over out-of-band. Everything derived from it — the
priors, the reports, the ADR, the 12 replay fixtures — **is** committed, so the conclusions
survive without the raw data.

## 4. What shipped

Three streams, planned in
`docs/superpowers/plans/2026-05-06-sleepcountry-bigquery-incorporation.md` (42 KB).

**Stream 1 — Calibration.** Offline fingerprinter labels all 11,629 sessions into the four
personas, then every testable inference rule is scored against those labels.
Commits `ea50c0e` (T0 ingest) → `a645106` (T1.1/T1.2 fingerprinter + distribution) →
`cce0e79` (T1.3/T1.4 rule scoring + verdict). Verdict recorded as **ADR-011**.

**Stream 2 — Referrer-keyed cold-start priors.** Downgraded mid-flight: the planned Neon
`cohort_priors` table keyed by `(referrer × postal_prefix × hour_bucket)` was abandoned
because postal collapsed (78.6% empty, 2 distinct values). Shipped instead as a generated
const map. Commit `3db0525`.

**Stream 3 — Dev-mode session replay.** 12 curated real anonymized shopper journeys,
replayable in the dev panel so you can watch the engine change its mind live. Commit
`acee20f`. Fixtures at `static/dev-fixtures/replay-sessions.json`.

**Plus the brand itself** (commit `58cdee3`): Sleep Country as 4th deploy —
`aisles-demo-4.biq.workers.dev`, CF AI Gateway `aisles-sleepcountry`, reusing the existing
BC store `cdfqf9k6zf` on the previously-inactive Demo channel (id=1). Brand isolation is by
`categoryPrefix: 'SleepCountry'`, **not** by separate store, so a new brand-scoped seeder
(`scripts/seed-brand-catalog.mjs`) replaced the destructive `setup-catalog.mjs` and hard-
aborts if any delete target falls outside the targeted brand's prefix. Catalog is 30
synthetic products across 5 categories modeled on sleepcountry.ca's mix and Canadian price
points, Unsplash imagery to avoid IP exposure.

**Demo reel** at `scripts/demo-reel/out/demo-reel.mp4` (13 scenes) narrates exactly this
arc — scenes 7 and 8 are "Grounded in real data" and "Six of ten transferred."

## 5. Findings — the part worth carrying

### 5.1 Fingerprint distribution (11,629 sessions)

| Persona | Count | Share | Plan target |
|---|---|---|---|
| researcher | 1,072 | 9.2% | 15–25% |
| hunter | 528 | 4.5% | 5–10% |
| gatherer | 136 | 1.2% | 5–10% |
| gifter | 19 | 0.2% | 1–5% |
| unknown | 9,874 | 84.9% | 60–75% |

Unknown blew past its band because of the bounce distribution, not because the heuristic is
bad. Tightening it would move labels *into* unknown, not produce better labels. Researcher
came in under band because sleep retail is more deliberative and lower-frequency than
off-price apparel — fewer sessions hit "compared 4 SKUs" inside one hour bucket. Max
confidence assigned anywhere is ~0.65; the heuristic is deliberately not over-confident.

### 5.2 Rule transferability — 10 testable of 28

| Rule | Target | Fires | Labeled | Precision | Verdict |
|---|---|---|---|---|---|
| `in-session-search-as-researcher` | researcher | 1,442 | 1,005 | **95.0%** | Strong — keep |
| `broad-category-browsing` | gatherer | 12 | 12 | **91.7%** | Strong — keep (n small) |
| `deep-product-exploration` | researcher | 511 | 214 | **74.3%** | Strong — keep |
| `desktop-weekday-deliberate` | researcher | 3,448 | 544 | 59.7% | Moderate — keep, degraded test |
| `rapid-cart-adds` | hunter | 17 | 6 | 33.3% | Weak — cart-orphan starved |
| `mobile-evening-impulse` | hunter | 6,321 | 973 | 31.0% | Moderate — degraded test |
| `in-session-search` (hunter half) | hunter | 1,442 | 1,005 | **1.4%** | **Off-target** |
| `referrer-social` | gatherer | 601 | 465 | **0.2%** | **Off-target** |
| `single-category-focus` | hunter | 304 | 21 | **0.0%** | **Off-target** |
| `referrer-deal-site` / `referrer-review-site` | — | 0 / 1 | 0 | n/a | Regionally inapplicable |

The other 18 rules are untestable against this extract — they consume search-query text,
dwell ms, scroll depth, device type, cart-removal counts, refine-chat counts, longitudinal
visit counts, or UTM strings, none of which survived the privacy filter. **Not invalidated,
just out of scope.**

### 5.3 The three wrong-direction rules — and why

This is the actual insight. All three fail the same way: an off-price-apparel intuition
**inverts** in sleep retail.

- **`referrer-social`** lifts gatherer in production (social = inspiration browsing). In
  sleep retail, 465 labeled fires are **99.6% hunter**. Social referrers here are paid-social
  ad-click traffic with direct purchase intent, not browse behavior. → per-brand override
  lifts **hunter** (0.3) for sleepcountry.
- **`in-session-search`** lifts hunter and researcher equally (search = refining a known
  purchase). In sleep retail the same 1,005 fires are **95.0% researcher, 1.4% hunter**.
  Mattress shoppers who search are comparison-shopping a high-stakes purchase. → drop the
  hunter half for sleepcountry; keep researcher at 0.15, arguably raise to 0.25.
- **`single-category-focus`** lifts hunter (staying in one category = knows what they want).
  In sleep retail 21 labeled fires are **0% hunter, 81% researcher**. Browsing only
  `/mattresses/*` is deliberation, not decisiveness. → lift **researcher** (0.15).
  n=21 is small; re-evaluate with more data.

`returning-shopper-apparel` is structurally inert here (its category whitelist —
women/men/kids/shoes/beauty/handbags/accessories/jewelry — cannot overlap sleep retail).
The deal-site and review-site rules are US-centric lists; Canada has RedFlagDeals and a
different review pattern. Neither is *wrong*, both are regionally inapplicable.

### 5.4 Referrer priors — the replacement for the Neon cohort table

Referrer alone turned out to be sharply discriminating, which is why the multi-dimensional
cohort table was over-engineered for the available signal. Shipped as
`src/lib/signals/sleepcountry-referrer-priors.ts`, applied at cold start when
`signalCount === 0 && brandId === 'sleepcountry'`. Cohorts under 30 labeled sessions emit
`null` and fall back to the default category prior.

| Referrer | researcher | hunter | gatherer | gifter | labeled n |
|---|---|---|---|---|---|
| internal | 0.85 | 0.04 | 0.09 | 0.02 | 1,109 |
| google | 0.87 | 0.00 | 0.13 | 0.00 | 46 |
| dormezvous | 0.86 | 0.03 | 0.10 | 0.01 | 72 |
| direct | 0.34 | 0.25 | 0.41 | 0.00 | 61 |
| facebook | 0.00 | **0.99** | 0.00 | 0.00 | 362 |
| instagram | 0.00 | **1.00** | 0.00 | 0.00 | 103 |
| youtube | — | — | — | — | 0 (null) |
| other | — | — | — | — | 2 (null) |

## 6. How this enhanced the Aisles concept

Four things changed, and they compound:

1. **The engine went from intuition-tuned to ground-truth-calibrated.** Before Sleep
   Country, every weight in `inference.ts` was a designer's mental model. After, ten of them
   have measured precision against real sessions and three known-wrong ones are corrected.
   The demo reel's claim — "Aisles isn't a product, it's a calibrated engine" — is only
   sayable because of this work.

2. **Per-brand rule gating became a first-class engine concept.** The rule set is no longer
   global. `inference.ts` now branches adjustment vectors on `brandId`, which is the
   structural admission that **retail category changes what a signal means**. That is a
   reusable architectural idea, not a Sleep Country patch. ADR-011 caps it deliberately:
   keep gated rules to ~3–5 or the evaluators get unmanageable.

3. **Cold start stopped being uniform.** A shopper with zero signals now gets a
   referrer-keyed prior instead of an even split — and for paid-social traffic that prior is
   near-certain. The engine is useful on the first pageview, which is most of the traffic
   given a p50 of 1 event.

4. **Real shopper journeys became a demo instrument.** The 12 replay fixtures let a viewer
   watch the engine revise its read mid-session on an actual anonymized journey rather than
   a synthetic script. That is a qualitatively different demo than "here's a layout."

Methodological residue worth keeping: **calibrate per category before assuming a persona
model transfers.** Three of ten rules inverted across a single category hop. Any future
Aisles brand in a new vertical should assume the same until scored.

## 7. Picking this up on another machine

```bash
# Get the branch (all analysis, code, docs, fixtures, demo reel)
git clone <bealls-aisles remote> && cd bealls-aisles
git fetch origin worktree-spike-cloudflare-portkey
git checkout worktree-spike-cloudflare-portkey
```

**File map:**

| Path | What |
|---|---|
| `docs/architecture/decisions/011-sleepcountry-rule-calibration.md` | The verdict. Read first. |
| `docs/spikes/2026-05-05-cloudflare-portkey/sleepcountry-rule-scoring.md` | Per-rule precision, method, caveats |
| `docs/spikes/2026-05-05-cloudflare-portkey/sleepcountry-fingerprint-distribution.md` | Distribution + referrer crosstab |
| `docs/spikes/2026-05-05-cloudflare-portkey/sleepcountry-data-quirks.md` | Why conclusions are bounded |
| `docs/superpowers/plans/2026-05-06-sleepcountry-bigquery-incorporation.md` | Original 3-stream plan |
| `scripts/analytics/load.mjs` | CSV ingest + summary |
| `scripts/analytics/fingerprint.mjs` | The labeling heuristic (ground truth generator) |
| `scripts/analytics/calibrate-rules.mjs` | Rule scoring |
| `scripts/analytics/derive-referrer-priors.mjs` | Generates the priors file |
| `src/lib/signals/sleepcountry-referrer-priors.ts` | Generated priors (committed) |
| `src/lib/signals/inference.ts` | The 28 rules + per-brand gating |
| `src/lib/brand/config.ts:375` | Sleep Country brand entry |
| `scripts/fixtures/sleepcountry-catalog.json` | 30-product synthetic catalog |
| `static/dev-fixtures/replay-sessions.json` | 12 curated replay journeys |
| `scripts/demo-reel/out/demo-reel.mp4` | 13-scene narrated reel |

**To regenerate the analysis** (requires the gitignored CSV — see §3):

```bash
node scripts/analytics/load.mjs --summary
node scripts/analytics/fingerprint.mjs --output data/sleepcountry-fingerprinted.jsonl
node scripts/analytics/fingerprint.mjs --summary
node scripts/analytics/calibrate-rules.mjs
node scripts/analytics/derive-referrer-priors.mjs   # rewrites the .ts priors file
```

## 8. Open threads

- **The calibration never propagated downstream.** `@bcss/persona-core` in
  `~/Workspace/dev/projects/bcss/packages/persona-core/` is a 27-rule engine extracted from
  bealls-aisles 0.3.0 — with **no** per-brand gating and **no** referrer priors. It carries
  the pre-calibration rule set including all three wrong-direction rules. If bcss ever runs
  against a non-apparel vertical, that is a live defect.
- **Branch is unmerged.** All of this lives on `worktree-spike-cloudflare-portkey`, not
  `main`. `main` has no Sleep Country brand, no calibration, no replay.
- **Empirical fitting deferred.** ADR-011's rejected alternative was "wait for outcome data
  and fit against conversion." A `learnedWeights` JSON path already exists in `inference.ts`
  for that pass. It needs session-outcome telemetry Aisles does not yet accumulate.
- **18 of 28 rules never evaluated.** Anything requiring query text, dwell, scroll, device,
  or cross-session identity needs a different data source than this extract.
- **`single-category-focus` override rests on n=21.** Directional at best. Re-score before
  trusting it.
- **Raw data is machine-local.** Re-export from BigQuery or transfer out-of-band.

## 9. Caveats you must carry forward

1. **Circular-validation risk — stated plainly in the ADR itself.** The fingerprinter is a
   heuristic that consumes some of the same low-level signals the rules do (referrer,
   multi-PDP browsing, search count). High precision may mean the rule and the fingerprinter
   agree, not that the rule is independently correct against real shopper outcomes. The
   three overrides are still defensible — they correct rules that were *wrong direction*,
   not merely uncalibrated — but treat the absolute precision numbers as internal-consistency
   checks, **not external validation**.
2. **Two rules were tested in degraded form.** `mobile-evening-impulse` and
   `desktop-weekday-deliberate` had their device-type half stripped (device data absent);
   their precision applies to a degraded version, not the production rule.
3. **Sample sizes vary wildly.** Treat n<100 as directional. No confidence intervals were
   computed.
4. **The catalog is synthetic.** 30 hand-curated products modeled on sleepcountry.ca's mix —
   not scraped, not real inventory. Sleep Country is a demo storefront, not a merchant deal.
   The *session data* is real and anonymized; the *catalog* is not.

## 10. Provenance of this document

The Claude Code session transcripts for this work no longer exist on the origin machine —
default retention rotated them out (oldest surviving transcript is 2026-06-05; this work
ran May 6–12). This brief was reconstructed on 2026-07-30 from three independent sources:
`~/.claude/history.jsonl` (which preserved the 16-prompt arc), the git history on this
branch, and direct reads of the committed source, ADR, and analysis reports. Every number
here was resolved from a committed file, not from a summary of one.

# ADR-011: Sleep retail calibration of the persona-inference rule set

**Date:** 2026-05-06
**Status:** Accepted
**Supersedes:** none. **Amends:** the rule set in `src/lib/signals/inference.ts` for sleepcountry-brand traffic specifically (other brands unchanged).

## Context

Aisles' persona-inference engine ships ~28 hand-tuned rules in `src/lib/signals/inference.ts`. They were authored against a mental model of off-price apparel shopping (the original Bealls / Bealls Florida / Home Centric deployment). Adding sleepcountry as a fourth brand exposed the question: do those rules transfer to a different retail category?

We have ground truth: 11,629 anonymized sleepcountry sessions from a 7-week BigQuery extract, fingerprinted offline by `scripts/analytics/fingerprint.mjs` into the four Aisles personas (researcher / hunter / gatherer / gifter / unknown). The fingerprinted dataset is the calibration target.

The full rule-by-rule scoring is in `docs/spikes/2026-05-05-cloudflare-portkey/sleepcountry-rule-scoring.md`. This ADR records the verdict.

### Data caveats

Three quirks of the BQ extract bound what we can conclude (full detail in `sleepcountry-data-quirks.md`):

1. **Cart attribution gap.** 95.6% of `SHOPPER_CART_*` events are orphan (no session_id). Sessions with attributable cart events: 4.4%. Cart-dependent rules have very thin support.
2. **Half the sessions are bounces.** p50=1 event, p75=2 events. The fingerprinter cannot label 84.9% of sessions ("unknown"). Precision numbers are computed against labeled fires only.
3. **Schema is post-privacy-filter.** UTM columns and most postal prefixes are absent. Rules consuming UTM or device-type fields cannot be evaluated against this extract.

### Untestable rules

Of the 28 rules in inference.ts, 18 cannot be evaluated against the BQ extract because the InferenceContext fields they consume (search-query string content, dwell ms, scroll depth, device type, cart-removal count, refine-chat counts, longitudinal visit count, UTM strings) are not in the data. They are not invalidated by this work; they are simply outside its scope.

10 rules are testable end-to-end or with documented degradations.

## Decision

The rule set in `src/lib/signals/inference.ts` is **kept as-is** for off-price apparel brands (bealls, beallsflorida, homecentric). For sleepcountry, the following per-brand adjustments apply:

### 1. Override `referrer-social` for sleepcountry: target inverts from `gatherer` to `hunter`

Calibration: the rule (`referrer matches pinterest|instagram|houzz`) lifts gatherer in production. Adapted to also include `facebook` (the dominant paid-social referrer in this dataset) and scored against gatherer: **precision 0.2%** across 465 labeled fires. The same 465 fires are 99% hunter-labeled by the fingerprinter.

The off-price-apparel intuition (social = inspiration browsing = gatherer) inverts in sleep retail. Social referrers in sleep retail are paid-social ad-click traffic with direct purchase intent — hunter behavior, not browse behavior.

**Action:** in `inference.ts`, gate the `referrer-social` rule's adjustment vector on a per-brand basis. For sleepcountry, the rule lifts hunter (0.3 weight) instead of gatherer. Implemented as part of the Stream 2 (downgraded) referrer-bias work.

### 2. Override `in-session-search` for sleepcountry: drop the hunter half

Calibration: the rule (`searchCount >= 2`) lifts hunter and researcher equally in production. Scored against each target on 1,005 labeled fires:
- Hunter precision: **1.4%**
- Researcher precision: **95.0%**

The hunter half of this rule is wrong direction for sleep retail. Mattress / pillow / bedding shoppers who search are not "refining a known purchase quickly"; they're comparison-shopping high-stakes purchases.

**Action:** in `inference.ts`, gate the `in-session-search` rule's adjustment vector on a per-brand basis. For sleepcountry, drop the hunter lift; keep the researcher lift at 0.15 (or raise to 0.25 given the high observed precision).

### 3. Override `single-category-focus` for sleepcountry: rule does not transfer

Calibration: the rule (`categoryViewCount >= 3 && uniqueCategoriesViewed.length === 1`) lifts hunter in production. Scored against hunter on 21 labeled fires: **precision 0.0%**. The fires are 0% hunter, 100% other-or-unknown personas.

In sleep retail, sticking within one category (e.g., browsing only `/mattresses/...`) is researcher behavior, not hunter behavior. The signal exists but points the wrong direction.

**Action:** in `inference.ts`, gate the `single-category-focus` rule's adjustment vector on a per-brand basis. For sleepcountry, the rule lifts researcher (0.15) instead of hunter. n=21 is small — re-evaluate after we have additional data.

### 4. `referrer-deal-site`, `referrer-review-site`: regional pattern mismatch, not invalidation

Calibration: the deal-site rule (`slickdeals|retailmenot|honey|google.com/shopping`) fires 0 times in this Canadian sleep-retail extract. The review-site rule (`wirecutter|consumerreports|reddit`) fires 1 time.

These are US-centric site lists. The rules are not wrong for the US off-price apparel market; they're regionally inapplicable. Sleep retail in Canada has different deal aggregators (e.g., RedFlagDeals) and review/comparison patterns.

**Action:** keep both rules in the codebase. Optionally extend the deal-site pattern to include `redflagdeals` if it appears in any future sleepcountry traffic. Not required for this ADR.

### 5. `returning-shopper-apparel`: structurally inapplicable, leave inert

The rule's category whitelist (`women|men|kids|shoes|beauty|handbags|accessories|jewelry`) does not overlap with sleep retail categories. The rule cannot fire on sleepcountry traffic. No action needed.

### 6. Strong-signal rules confirmed for sleepcountry: keep as-is

- `broad-category-browsing` → gatherer: **91.7%** precision (n=12)
- `deep-product-exploration` → researcher: **74.3%** precision (n=214)
- `desktop-weekday-deliberate` → researcher: 59.7% precision (n=544, with stripped-device caveat)
- `mobile-evening-impulse` → hunter: 31.0% precision (with stripped-device caveat) — moderate; keep at current weight

These rules transfer to sleep retail without modification.

### 7. Cohort priors via Neon table: not built

The original Stream 2 plan called for a `cohort_priors` Neon table keyed by `(referrer × postal_prefix × hour_bucket)`. Calibration support:

- Postal prefix is 78.6% empty with only 2 distinct values. Drops as a useful dimension.
- Referrer alone is highly discriminating: facebook → 99% hunter, instagram → 100% hunter, internal → 85% researcher (n=1,109), google → 87% researcher (n=46).

The full Neon table is over-engineered for the available signal. The simplified Stream 2 ships a `SLEEPCOUNTRY_REFERRER_PRIORS` const map in `src/lib/signals/sleepcountry-referrer-priors.ts`, derived from the same fingerprinting pass, applied at cold start when `signalCount === 0` and `brandId === 'sleepcountry'`.

## Considered alternatives

- **Replace the rule set wholesale for sleepcountry.** Rejected. 6 of 10 testable rules transfer cleanly or near-cleanly. Three need per-brand overrides; the rest are inert (structurally inapplicable) or unevaluated. Surgical per-brand gating is lower risk than a wholesale fork of the rule set.
- **Wait for outcome data and fit empirically.** Rejected for now — the fingerprinter is the only ground truth we have for sleepcountry. Empirical fitting against conversion outcomes is the right next step once Aisles ships sleepcountry to internal audiences and we accumulate session-outcome telemetry. A `learnedWeights` JSON path already exists in `inference.ts` for that future pass.
- **Skip per-brand overrides; accept off-target rules in production.** Rejected for the three rules with measured 0-2% precision. The harm is small (the engine softmaxes over many signals) but the misdirection is documented; correcting a known wrong-direction rule is cheap.

## Consequences

**Positive:**
- The three off-target rules (`referrer-social`, `in-session-search` hunter half, `single-category-focus`) get per-brand corrections informed by ground truth, not a guess.
- The strong rules (`broad-category-browsing`, `deep-product-exploration`) are now data-confirmed for sleep retail, not just intuition.
- The simplified Stream 2 referrer-bias rule has a published derivation: anyone reviewing the priors can trace them back to the same fingerprint that informed this ADR.
- The untestable-rules list is captured, so future evaluation work has a clear scope.

**Negative / accepted:**
- Per-brand gating in `inference.ts` adds branching to the rule evaluators. Stays manageable as long as the gated rule count stays small (~3-5 rules).
- The fingerprinter is itself a heuristic. High precision on a rule may reflect that the rule and the fingerprinter agree, not that the rule is independently correct vs real shopper outcomes. This is the circular-validation risk noted in the rule-scoring report. The gating decisions are still defensible — they correct rules that were *wrong direction* relative to the fingerprinter, not rules that were merely uncalibrated — but the absolute precision numbers are internal-consistency checks, not external validation.
- 18 of 28 rules remain unevaluated against this dataset. The ones we touched are the ones we can defend.

## References

- Rule-scoring report: `docs/spikes/2026-05-05-cloudflare-portkey/sleepcountry-rule-scoring.md`
- Fingerprint distribution: `docs/spikes/2026-05-05-cloudflare-portkey/sleepcountry-fingerprint-distribution.md`
- Data quality findings: `docs/spikes/2026-05-05-cloudflare-portkey/sleepcountry-data-quirks.md`
- Original BQ-incorporation plan: `docs/superpowers/plans/2026-05-06-sleepcountry-bigquery-incorporation.md`
- Calibration scripts: `scripts/analytics/fingerprint.mjs`, `scripts/analytics/calibrate-rules.mjs`

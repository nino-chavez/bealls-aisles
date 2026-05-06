# Sleep Country — inference-rule scoring

**Captured:** 2026-05-06
**Source:** scoring `src/lib/signals/inference.ts` rules against the fingerprinted ground truth in `data/sleepcountry-fingerprinted.jsonl` (11,629 sessions).
**Run:** `node scripts/analytics/calibrate-rules.mjs`

## Method

For each testable rule, derive the relevant InferenceContext fields from session events (per `deriveContext()` in the script), determine whether the rule fires, and bucket fires by ground-truth persona label.

**Precision** is computed against the rule's primary persona target (the persona whose probability gets the largest lift in the rule's adjustment vector), restricted to *labeled* fires (excluding fires where the fingerprinter returned "unknown").

Sessions whose fingerprint label is "unknown" are excluded from the precision denominator. An "unknown" outcome means the heuristic couldn't support a label, not that the rule was wrong.

## Testable rules

| Rule | Target | Fires | Labeled | Precision (target persona) | Persona breakdown |
|---|---|---|---|---|---|
| `referrer-social` | gatherer | 601 (5.2%) | 465 | 0.2% | R=1 H=463 G=1 G=0 |
| `referrer-deal-site` | hunter | 0 (0.0%) | 0 | n/a | R=0 H=0 G=0 G=0 |
| `referrer-review-site` | researcher | 1 (0.0%) | 0 | n/a | R=0 H=0 G=0 G=0 |
| `broad-category-browsing` | gatherer | 12 (0.1%) | 12 | 91.7% | R=1 H=0 G=11 G=0 |
| `rapid-cart-adds` | hunter | 17 (0.1%) | 6 | 33.3% | R=2 H=2 G=0 G=2 |
| `in-session-search` | hunter | 1442 (12.4%) | 1005 | 1.4% | R=955 H=14 G=34 G=2 |
| `in-session-search-as-researcher` | researcher | 1442 (12.4%) | 1005 | 95.0% | R=955 H=14 G=34 G=2 |
| `deep-product-exploration` | researcher | 511 (4.4%) | 214 | 74.3% | R=159 H=27 G=24 G=4 |
| `single-category-focus` | hunter | 304 (2.6%) | 21 | 0.0% | R=17 H=0 G=4 G=0 |
| `mobile-evening-impulse` | hunter | 6321 (54.4%) | 973 | 31.0% | R=575 H=302 G=92 G=4 |
| `desktop-weekday-deliberate` | researcher | 3448 (29.7%) | 544 | 59.7% | R=325 H=179 G=28 G=12 |

## Per-rule notes

### `referrer-social`

> Original matches pinterest|instagram|houzz; adapted to also include facebook (paid social in this dataset).

Fires 601 times across all sessions. Of 465 labeled fires, 1 were gatherer (precision 0.2%). **Off-target** — does not transfer to sleep retail.

Persona distribution among fires:

| Persona | Count | Share of labeled fires |
|---|---|---|
| researcher | 1 | 0.2% |
| hunter | 463 | 99.6% |
| gatherer | 1 | 0.2% |
| gifter | 0 | 0.0% |
| (unknown — excluded from precision) | 136 | — |

### `referrer-deal-site`

> Pattern slickdeals|retailmenot|honey|google.com/shopping — never matches in this data.

Never fires on this dataset.

Persona distribution among fires:

| Persona | Count | Share of labeled fires |
|---|---|---|
| researcher | 0 | 0.0% |
| hunter | 0 | 0.0% |
| gatherer | 0 | 0.0% |
| gifter | 0 | 0.0% |
| (unknown — excluded from precision) | 0 | — |

### `referrer-review-site`

> Pattern wirecutter|consumerreports|reddit — never matches in this data.

Fires 1 times but no labeled-persona fires (all fingerprinted as "unknown"). Cannot evaluate.

Persona distribution among fires:

| Persona | Count | Share of labeled fires |
|---|---|---|
| researcher | 0 | 0.0% |
| hunter | 0 | 0.0% |
| gatherer | 0 | 0.0% |
| gifter | 0 | 0.0% |
| (unknown — excluded from precision) | 1 | — |

### `broad-category-browsing`

Fires 12 times across all sessions. Of 12 labeled fires, 11 were gatherer (precision 91.7%). **Strong signal** — keep.

Persona distribution among fires:

| Persona | Count | Share of labeled fires |
|---|---|---|
| researcher | 1 | 8.3% |
| hunter | 0 | 0.0% |
| gatherer | 11 | 91.7% |
| gifter | 0 | 0.0% |
| (unknown — excluded from precision) | 0 | — |

### `rapid-cart-adds`

> Rule requires cartAddCount >= 2; cart events are 95.6% orphan in this data.

Fires 17 times across all sessions. Of 6 labeled fires, 2 were hunter (precision 33.3%). Weak signal — re-evaluate or adapt.

Persona distribution among fires:

| Persona | Count | Share of labeled fires |
|---|---|---|
| researcher | 2 | 33.3% |
| hunter | 2 | 33.3% |
| gatherer | 0 | 0.0% |
| gifter | 2 | 33.3% |
| (unknown — excluded from precision) | 11 | — |

### `in-session-search`

> Rule lifts hunter and researcher equally; we score against hunter (the wider-net target). Re-score against researcher.

Fires 1442 times across all sessions. Of 1005 labeled fires, 14 were hunter (precision 1.4%). **Off-target** — does not transfer to sleep retail.

Persona distribution among fires:

| Persona | Count | Share of labeled fires |
|---|---|---|
| researcher | 955 | 95.0% |
| hunter | 14 | 1.4% |
| gatherer | 34 | 3.4% |
| gifter | 2 | 0.2% |
| (unknown — excluded from precision) | 437 | — |

### `in-session-search-as-researcher`

> Same rule, scored against researcher target.

Fires 1442 times across all sessions. Of 1005 labeled fires, 955 were researcher (precision 95.0%). **Strong signal** — keep.

Persona distribution among fires:

| Persona | Count | Share of labeled fires |
|---|---|---|
| researcher | 955 | 95.0% |
| hunter | 14 | 1.4% |
| gatherer | 34 | 3.4% |
| gifter | 2 | 0.2% |
| (unknown — excluded from precision) | 437 | — |

### `deep-product-exploration`

Fires 511 times across all sessions. Of 214 labeled fires, 159 were researcher (precision 74.3%). **Strong signal** — keep.

Persona distribution among fires:

| Persona | Count | Share of labeled fires |
|---|---|---|
| researcher | 159 | 74.3% |
| hunter | 27 | 12.6% |
| gatherer | 24 | 11.2% |
| gifter | 4 | 1.9% |
| (unknown — excluded from precision) | 297 | — |

### `single-category-focus`

Fires 304 times across all sessions. Of 21 labeled fires, 0 were hunter (precision 0.0%). **Off-target** — does not transfer to sleep retail.

Persona distribution among fires:

| Persona | Count | Share of labeled fires |
|---|---|---|
| researcher | 17 | 81.0% |
| hunter | 0 | 0.0% |
| gatherer | 4 | 19.0% |
| gifter | 0 | 0.0% |
| (unknown — excluded from precision) | 283 | — |

### `mobile-evening-impulse`

> Rule requires deviceType=mobile (not in BQ extract). Approximated by hour-of-day only — strips the device half of the rule.

Fires 6321 times across all sessions. Of 973 labeled fires, 302 were hunter (precision 31.0%). Weak signal — re-evaluate or adapt.

Persona distribution among fires:

| Persona | Count | Share of labeled fires |
|---|---|---|
| researcher | 575 | 59.1% |
| hunter | 302 | 31.0% |
| gatherer | 92 | 9.5% |
| gifter | 4 | 0.4% |
| (unknown — excluded from precision) | 5348 | — |

### `desktop-weekday-deliberate`

> Rule requires deviceType=desktop and dayOfWeek (1-5). Approximated by hour-of-day 9-17 only — strips device + weekday halves.

Fires 3448 times across all sessions. Of 544 labeled fires, 325 were researcher (precision 59.7%). Moderate signal — keep with reduced weight.

Persona distribution among fires:

| Persona | Count | Share of labeled fires |
|---|---|---|
| researcher | 325 | 59.7% |
| hunter | 179 | 32.9% |
| gatherer | 28 | 5.1% |
| gifter | 12 | 2.2% |
| (unknown — excluded from precision) | 2904 | — |

## Untestable rules

The following rules cannot be evaluated against this dataset — the InferenceContext fields they require are not present in the BQ session-event extract.

| Rule | Why untestable |
|---|---|
| `intent-param` | Runtime URL param; not derivable from BQ session events. |
| `search-hunter-keywords` | Requires search-query string content; BQ extract has SEARCH_PRODUCT events without query text. |
| `search-researcher-keywords` | Same as above. |
| `search-gifter-keywords` | Same as above. |
| `search-gatherer-keywords` | Same as above. |
| `utm-gift-campaign` | UTM columns dropped in 2026-05-06 schema update. |
| `utm-sale-campaign` | Same. |
| `returning-same-category` | Cross-session state (storedPersona, storedCategory); BQ extract has no longitudinal user identity. |
| `returning-different-category` | Same. |
| `repeat-visitor-familiarity` | Requires visitCount across sessions; BQ session_id is per-session-only. |
| `returning-shopper-apparel` | Same as above + apparel-specific category list (not sleep retail). |
| `comparison-browsing` | Requires backNavigationCount; BQ events are page hits, not navigation actions. |
| `refinement-chat-engaged` | Requires refineMessageCount (chat interactions); not present in BQ. |
| `deep-scroll-exploration` | Requires maxScrollDepth; not present in BQ. |
| `long-product-dwell` | Requires longDwellCount and avgDwellTimeMs; BQ timestamps are hour-bucketed, no dwell measurement. |
| `quick-product-scanning` | Same as above. |
| `quick-bounce-pattern` | Same as above. |
| `cart-removal-indecision` | Requires cartRemovalCount; BQ has SHOPPER_CART_UPDATED but no add-vs-remove distinction (and 95.6% orphan). |

## Caveats

1. **Circular validation risk.** The fingerprinter and several inference rules consume similar low-level signals (referrer, multi-PDP browsing, search count). High precision on a rule may reflect that both the rule and the fingerprinter agree, not that the rule is independently correct. Where the rule fires on a signal the fingerprinter also uses to label, treat precision numbers as internal-consistency checks, not external validation.
2. **Adapted rules are flagged.** Two rules (`mobile-evening-impulse`, `desktop-weekday-deliberate`) had their device-type half stripped because device data is absent; their precision applies to a degraded version of the rule, not the production version.
3. **`in-session-search` is dual-target.** The original rule lifts hunter and researcher equally. It is scored twice (against each target).
4. **Sample sizes vary.** Some rules fire on a few hundred sessions; others on a few. Treat precision numbers with low fire counts as directional, not significant. The report does not compute confidence intervals; eyeball n>100 as the threshold for taking a precision number at face value.

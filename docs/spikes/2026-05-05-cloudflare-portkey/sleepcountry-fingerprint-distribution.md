# Sleep Country fingerprinting — distribution report

**Captured:** 2026-05-06
**Heuristic version:** `scripts/analytics/fingerprint.mjs` (initial)
**Run:** `node scripts/analytics/fingerprint.mjs --summary`
**Output:** `data/sleepcountry-fingerprinted.jsonl` (gitignored, 11,629 lines)

## Persona distribution (11,629 sessions)

| Persona | Count | Share | Plan target |
|---|---|---|---|
| researcher | 1,072 | 9.2% | 15-25% |
| hunter | 528 | 4.5% | 5-10% |
| gatherer | 136 | 1.2% | 5-10% |
| gifter | 19 | 0.2% | 1-5% |
| unknown | 9,874 | 84.9% | 60-75% |

The unknown bucket exceeds the plan's expected range, but that's a function of session-length distribution (p50=1, p75=2 events). Half the sessions cannot carry enough signal to label cleanly. Tightening the heuristic would shift labels into Unknown, not produce more useful labels.

Hunter is at 4.5% — within the plan range and aligned with the cart-attribution ceiling (510 sessions with attributable cart events, per `sleepcountry-data-quirks.md`).

Researcher at 9.2% is below the plan's 15-25% range. The plan's range was derived for off-price apparel where casual browsing of multiple SKUs is the dominant pattern. Sleep retail is more deliberative and lower-frequency; fewer sessions reach the "compared 4 mattresses" threshold within a single hour-bucket.

Gifter at 0.2% is suppressed by the cart-attribution gap. The heuristic requires a checkout event in the session, which is itself rare (1.0% reach checkout). Of those, most also viewed mattress PDPs at some point (which moves them into researcher). Only 19 sessions cleanly match "checkout, no mattress PDPs at all."

## Confidence distribution

| Band | Count | Share |
|---|---|---|
| 0.0-0.2 | 9,875 | 84.9% |
| 0.2-0.4 | 1,114 | 9.6% |
| 0.4-0.6 | 624 | 5.4% |
| 0.6-0.8 | 16 | 0.1% |
| 0.8-1.0 | 0 | 0.0% |

No session reaches confidence ≥0.8. The maximum confidence assigned is roughly 0.65 (researcher with both heavy multi-PDP and search signals). This is intentional — the heuristic is conservative, not over-confident on any single signal. For curated demo fixtures we'll want sessions in the 0.4-0.6 band where the label is well-supported by multiple signals.

## Referrer × persona crosstab

The most important calibration finding for the simplified Stream 2 (referrer-bias rule).

|             | direct | dormez | fb     | google | insta  | internal | other | youtube |
|---          |---     |---     |---     |---     |---     |---       |---    |---      |
| researcher  | 21     | 62     | 1      | 40     | 0      | **947**  | 1     | 0       |
| hunter      | 15     | 2      | **360**| 0      | **103**| 48       | 0     | 0       |
| gatherer    | 25     | 7      | 1      | 6      | 0      | 96       | 1     | 0       |
| gifter      | 0      | 1      | 0      | 0      | 0      | 18       | 0     | 0       |
| unknown     | 1,982  | 780    | 114    | 1,189  | 22     | 5,622    | 137   | 28      |

### Referrer-prior derivations (excluding "unknown")

For each referrer bucket, the labeled-only persona share. Cohorts with <30 labeled sessions fall back to uniform (marked `n/a`).

| Referrer | Labeled n | researcher | hunter | gatherer | gifter | Notes |
|---|---|---|---|---|---|---|
| internal | 1,109 | 0.85 | 0.04 | 0.09 | 0.02 | Strongly researcher-skewed: most internal navigation is mattress-comparison browsing within site. |
| google | 46 | 0.87 | 0.00 | 0.13 | 0.00 | Search-engine entry is researcher-dominant. n thin (46) — borderline; ship but flag in ADR. |
| dormezvous | 72 | 0.86 | 0.03 | 0.10 | 0.01 | Sister-brand cross-traffic mirrors internal. Treat similarly. |
| facebook | 362 | 0.00 | **0.99** | 0.00 | 0.00 | Hunter-dominant. **The cleanest signal in the entire dataset.** |
| instagram | 103 | 0.00 | **1.00** | 0.00 | 0.00 | Identical pattern to facebook. |
| direct | 61 | 0.34 | 0.25 | 0.41 | 0.00 | Mixed — direct entries split across researcher/gatherer/hunter. Ship with low confidence weight. |
| other | 2 | n/a | n/a | n/a | n/a | Insufficient labeled support; fall back to uniform. |
| youtube | 0 | n/a | n/a | n/a | n/a | Zero labeled. Fall back to uniform. |

**Headline finding:** A session entering from `facebook.com` or `instagram.com` is essentially certain to be a hunter (per this fingerprint). A session entering via `internal` or search-engine referrer is very likely a researcher. Direct-traffic sessions are genuinely mixed and don't carry strong prior signal.

This is exactly the discriminating signal the Stream 2 (downgraded) referrer-bias rule needs. The output above can be encoded directly as the `SLEEPCOUNTRY_REFERRER_PRIORS` const in Task 2.1 of the amended plan.

## Caveats

1. **Hunter bias from the heuristic itself.** The hunter rule rewards "social referrer + landed on PDP" with 0.45 confidence base. Naturally, sessions that match this rule are guaranteed to be labeled hunter. The crosstab confirms the heuristic is consistent with itself but is **not** independent evidence that fb/insta sessions are universally hunter-intent in reality. To get independent validation, we'd need post-hoc conversion data, which we don't have. Document this as a known circular-reasoning risk in ADR-011.

2. **Internal-referrer dominance.** 5,622 of 9,874 unknown sessions (57%) entered from `internal`. Most are 1-2 page sessions that simply didn't accumulate enough behavior to label. The internal-referrer prior we derive is from the labeled minority (1,109 sessions); the 5,622 unknown internal sessions don't enter the prior calculation.

3. **Gifter is statistically thin (n=19).** The gifter prior is essentially synthetic. Document in ADR-011 and consider dropping gifter from the persona panel UI for sleepcountry until we have more conclusive evidence the persona transfers to sleep retail.

4. **Single-event sessions can still match hunter.** A 1-event session that lands on a PDP from facebook gets labeled hunter at 0.55 confidence. This is by design — the entry signal alone is the strongest hunter discriminator we have — but it inflates the hunter count with bouncers. Consider downweighting hunter labels at session-length=1 when generating the referrer prior.

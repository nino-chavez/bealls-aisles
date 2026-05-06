# Sleep Country event-log data quirks

**Captured:** 2026-05-06
**Source:** `data/sleepcountry-events.csv` (gitignored; copied from `sleepcountry_sanitized_filtered (1).csv`)
**Run:** `node scripts/analytics/load.mjs --summary`

These are observations from the first ingest pass. They affect how Streams 1, 2, and 3 of `2026-05-06-sleepcountry-bigquery-incorporation.md` should be sized and scoped.

## Counts

| Metric | Value |
|---|---|
| File rows (incl. header) | 29,871 |
| Total event rows | 29,870 |
| Rows with session attribution | 28,623 (95.8%) |
| Orphan rows (no `session_id_hashed`) | 1,247 (4.2%) |
| Distinct sessions | 11,629 |
| Mean events / session | 2.46 |
| Session length p50 / p75 / p90 / p99 / max | 1 / 2 / 5 / 17 / 211 |

## Quirk 1: Cart and checkout funnel events are mostly orphan

Top orphan event types:

| Event | Orphan count | Attached count |
|---|---|---|
| `SHOPPER_CART_UPDATED` | 728 | 0 |
| `SHOPPER_CHECKOUT_COMPLETED` | 194 | 0 |
| `SHOPPER_PAYMENT_DETAILS_PROVIDED` | 194 | 173 |
| `SHOPPER_PAGE_VIEWED` | 78 | 8,109 |
| `SHOPPER_VISIT_STARTED` | 24 | 964 |

`SHOPPER_CART_UPDATED` and `SHOPPER_CHECKOUT_COMPLETED` are entirely server-side / unattributed in this export. They cannot be tied to a specific shopper trajectory.

**Effect on session-level rollups:**
- Sessions with any cart event: **510 (4.4%)**
- Sessions reaching checkout: **117 (1.0%)**

The hunter heuristic in the BQ-incorporation plan ("≥1 cart event in session") is hard-capped at 510 sessions worth of training labels. Same for any heuristic that depends on funnel progression.

## Quirk 2: Postal prefix is sparse and low-cardinality

| Postal prefix | Session entries |
|---|---|
| `(empty)` | 9,137 (78.6%) |
| `L6T` | 1,904 (16.4%) — Mississauga ON |
| `H9R` | 588 (5.1%) — Pointe-Claire QC |

Only **2,519 sessions (21.7%)** have any postal prefix at all, and the entire data set covers two FSA buckets. The plan's cohort-prior dimension `(referrer × postal_prefix × hour_bucket)` collapses in practice to:
- `(referrer × hour_bucket)` for 78.6% of sessions
- `(referrer × {L6T,H9R} × hour_bucket)` for 21.4% of sessions

Postal is reduced from a useful refinement dimension to a mostly-empty optional discriminator. Only L6T-vs-H9R splits will get any support; L6T (suburban GTA, anglophone) vs H9R (suburban Montréal West Island, francophone) does carry plausible signal — but not many cohorts will have ≥20 sessions to clear the smoothing threshold.

## Quirk 3: Session-length distribution is heavily right-skewed

p50 = 1 event. p75 = 2 events. Half of all sessions are single-page-view bounces with no fingerprintable behavior. Only the **top ~10% of sessions (≥5 events)** carry enough signal for any non-trivial heuristic.

Implication for fingerprinting: the "Unknown" bucket will be very large — likely 70-85% of sessions. The plan's distribution table called this out; data confirms.

## Quirk 4: Referrer mix shows a Sleep-Country-internal-heavy traffic pattern

| Referrer (entry) | Sessions |
|---|---|
| `internal` (within sleepcountry.ca) | 6,731 (57.9%) |
| `direct` | 2,043 (17.6%) |
| `google.com` | 1,235 (10.6%) |
| `dormezvous.com` (sister brand) | 852 (7.3%) |
| `facebook.com` | 476 (4.1%) |
| `instagram.com` | 125 (1.1%) |
| `youtube.com` | 28 (0.2%) |

The `internal` referrer dominates entry mix. This is sessions that started inside sleepcountry.ca itself (e.g., navigating from one page to another). Without timestamp granularity finer than the hour, we can't reliably attribute these as "in-session continuations" vs "new sessions from internal links" — it depends entirely on how the BQ pipeline aggregated them. For cohort-prior purposes, treat `internal` as its own first-class entry condition; do not collapse it into `direct`.

## Implications for plan tasks

| Task | Implication |
|---|---|
| **T1.1 Fingerprint heuristic** | Hunter rule needs softening — without cart attribution, cap on hunter labels is 4.4% of sessions. Consider broadening: "social-referrer + ≥1 PDP visit" without requiring cart. |
| **T1.2 Distribution check** | Expect Unknown to be 70-85% (vs the plan's 60-75%). Don't over-tighten heuristics chasing that band. |
| **T1.3 Rule scoring** | Hunter rules will have low statistical power (n ≤ 510). Report confidence intervals, not just point precision. |
| **T2.1 Cohort priors** | Drop postal_prefix from the primary cohort key. New shape: `(referrer × hour_bucket)` as primary key with optional `postal_prefix` refinement only for L6T or H9R cohorts that have ≥30 labeled sessions. |
| **T2.5 Holdout eval** | If priors don't lift log-likelihood >5% over uniform, the cohort approach for sleep retail is unproven on this data; document and skip Stream 2 deployment. Bar lowered from 10% in the plan. |
| **T3.1 Replay fixtures** | Filter to the ≥5-event top decile; still leaves ~1,160 candidate sessions, plenty for 12-session curation. |

These quirks are not blockers — they reshape the value proposition of Streams 2 and 3 modestly, and tighten the size of training labels for Stream 1. Document the actual numbers reached during T1.4 (calibration verdict) for traceability.

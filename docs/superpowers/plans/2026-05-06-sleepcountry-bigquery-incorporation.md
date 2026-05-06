# Sleep Country BigQuery Data Incorporation — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use Sleep Country's BigQuery-derived event log (29,870 events / 11,630 sessions / 7-week window, sanitized + hashed) to (1) calibrate the Aisles inference engine against ground-truth shopper behavior, (2) seed cohort-aware persona priors at session start, and (3) ship a dev-mode "session replay" feature that lets demo audiences watch the engine react to real anonymized shopper journeys in real time.

**Architecture:** Three workstreams, ordered by dependency. **Stream 1 (calibration)** is offline-only — produces a report and an ADR; no runtime change. It establishes the persona-fingerprinting heuristic that streams 2 and 3 reuse. **Stream 2 (cohort priors)** modifies the engine's persona-inference cold start: a new Neon table holds priors per `(referrer, postal-prefix, hour-bucket)` cluster; `inference.ts` reads it before applying signal rules. **Stream 3 (session replay)** is foundation+engine cross-cutting — a curated subset of real sessions becomes a fixture, a Svelte component in the dev toolbar drives navigation + signal emission to replay them, the existing inference and AI-layout pipeline reacts as if the events were live.

> **2026-05-06 schema update:** The privacy-filtered CSV dropped UTM columns (`utm_source`, `utm_medium`, `utm_campaign`). Working schema: `event, session_id_hashed, timestamp_hour, referrer_domain, request_path, postal_prefix`. Plan has been amended throughout: cohort key dropped to `(referrer × postal_prefix × hour_bucket)`; hunter heuristic re-grounded on referrer + cart funnel instead of `utm_medium=cpc`; replay fixture and replay engine no longer attach UTM params. `referrer_domain` remains the paid-vs-organic-vs-direct discriminator (`facebook.com`, `instagram.com`, `google.com`, `internal`, `dormezvous.com`, `(direct)`).

**Tech stack:** Node scripts for offline analysis (Stream 1), Neon Postgres + small modification to `src/lib/signals/inference.ts` (Stream 2), Svelte 5 component + `src/lib/signals/emitter.ts` integration + JSON fixture (Stream 3). No new runtime dependencies.

---

## Cross-cutting setup

These apply to all three streams.

- **Data location:** `data/sleepcountry-events.csv` (gitignored — see `.gitignore` addition in T0). The file is already sanitized (no PII, hashed session IDs, hour-bucketed timestamps, postal prefix only) but is production-derived and shouldn't enter the repo.
- **Persona fingerprinting:** the heuristic that maps each session to a probable persona based on its event sequence. Used as ground-truth label for calibration (Stream 1) and as the basis for cohort-prior derivation (Stream 2). Lives in `scripts/analytics/fingerprint.mjs` (Stream 1, reused by Stream 2).
- **Branch strategy:** all three streams land on the `worktree-spike-cloudflare-portkey` branch alongside the existing Cloudflare deployment work. No PR yet — the parallel-deploy branch strategy decision (open question in ADR-010) still pending.

## Task 0: Setup

**Files:**
- Create: `data/` directory
- Modify: `.gitignore`
- Modify: `docs/architecture/decisions/README.md` (placeholder for ADR-011)

- [ ] **Step 1: Add data directory to gitignore**

```bash
mkdir -p data
echo "" >> .gitignore
echo "# Production-derived analytics data (anonymized but not for repo)" >> .gitignore
echo "data/" >> .gitignore
git add .gitignore
git commit -m "chore: gitignore data/ for production-derived analytics"
```

- [ ] **Step 2: Copy the CSV in**

```bash
cp "/Users/nino.chavez/Downloads/sleepcountry_sanitized_filtered (1).csv" data/sleepcountry-events.csv
wc -l data/sleepcountry-events.csv  # expect 29871 (29870 events + 1 header)
head -1 data/sleepcountry-events.csv  # expect: event,session_id_hashed,timestamp_hour,referrer_domain,request_path,postal_prefix
```

- [ ] **Step 3: Place the report HTML alongside for reference**

```bash
cp /Users/nino.chavez/Downloads/sleepcountry_report.html data/sleepcountry-report.html
```

(Both gitignored. Useful for grepping back into the source dataset's analyst commentary while writing the calibration code.)

---

# Stream 1 — Calibration

**Goal:** Apply persona fingerprinting to all 11,633 sessions, then evaluate whether the existing Aisles inference rules predict those personas. Output: a calibration report identifying which rules carry signal for sleep retail vs. which need replacement.

**Why this is first:** rules calibrated for off-price apparel may or may not transfer to mattress retail. Without this evaluation we're flying blind on Stream 2.

**Estimated effort:** 1 day active.

## Task 1.1: Persona fingerprinting heuristic

**Files:**
- Create: `scripts/analytics/fingerprint.mjs`
- Create: `scripts/analytics/lib/csv.mjs` (small streaming CSV parser)

- [ ] **Step 1: Define the fingerprinting rules**

Persona definitions for sleep retail (per ADR-005 + sleepcountry brand prompt — adjusted for domain):

- **Researcher (high-stakes purchase, comparison-driven):** session has ≥3 `SEARCH_PRODUCT` events OR ≥4 distinct `PRODUCT_PAGE_VIEWED` paths in different mattress brand sub-paths (`/products/sealy-*`, `/products/tempur-*`, `/products/bloom-*`).
- **Hunter (sale-watching, direct intent):** session entered via a paid-social referrer (`facebook.com` / `instagram.com`) OR landed directly on a `/products/...` PDP from any referrer, AND has ≥1 cart event (`SHOPPER_CART_*`) within the session. Without UTM medium we can't separate paid from organic social cleanly; fall back to "social-domain referrer with cart funnel engagement" as the hunter signature.
- **Gatherer (browsing, low intent):** session has `SHOPPER_PAGE_VIEWED` events spanning ≥3 distinct top-level paths (`/mattresses`, `/bedding`, `/pillows`, `/`) AND zero cart events.
- **Gifter (specific small-ticket purchase):** session ends in `SHOPPER_CHECKOUT_COMPLETED` AND only viewed products in `/bedding`, `/pillows`, or `/accessories` paths (not `/mattresses`).
- **Unknown:** doesn't match any. Expected to be the largest bucket — most sessions won't have enough events to fingerprint.

Write each rule as a function in `fingerprint.mjs` that takes a session's events array and returns `{ persona: 'researcher'|'hunter'|'gatherer'|'gifter'|'unknown', confidence: 0..1, evidence: string[] }`.

- [ ] **Step 2: Stream the CSV and group by session**

```js
// pseudo
const sessions = new Map();
for await (const row of streamCsv('data/sleepcountry-events.csv')) {
  if (!sessions.has(row.session_id_hashed)) sessions.set(row.session_id_hashed, []);
  sessions.get(row.session_id_hashed).push(row);
}
```

- [ ] **Step 3: Apply fingerprinting + emit per-session output**

For each session, run the fingerprinting and write to `data/sleepcountry-fingerprinted.jsonl` (one session per line):

```jsonl
{"session_id":"b3feb531...","persona":"researcher","confidence":0.8,"event_count":7,"entry":{"referrer":"google.com","postal_prefix":"L6T","hour":12},"evidence":["3 SEARCH_PRODUCT events","4 distinct mattress brand pages"]}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/analytics/
git commit -m "feat(analytics): persona fingerprinting heuristic for session-event traces"
```

## Task 1.2: Run fingerprinting + sanity-check distribution

- [ ] **Step 1: Execute**

```bash
node scripts/analytics/fingerprint.mjs --input data/sleepcountry-events.csv --output data/sleepcountry-fingerprinted.jsonl
```

- [ ] **Step 2: Print distribution**

Add a `--summary` flag that re-reads the JSONL and prints persona counts. Expected order of magnitude:

| Persona | Expected | Sanity check |
|---|---|---|
| Unknown | 60-75% | Most short sessions — single page view, no signal. |
| Researcher | 15-25% | Heavy search + multi-PDP signature. |
| Hunter | 5-10% | Social-referrer-to-cart sessions. |
| Gatherer | 5-10% | Multi-category browse. |
| Gifter | 1-5% | Small-ticket-only checkout. |

If the distribution is wildly off (e.g., 95% researcher), the fingerprinting rules are too generous; tighten them.

- [ ] **Step 3: Spot-check 10 sessions of each persona**

```bash
node scripts/analytics/fingerprint.mjs --persona researcher --limit 10 --verbose
```

For each, print the full event sequence + the fingerprinting evidence. Eyeball whether the label matches what the events actually look like. If half the "researchers" look like browsing gatherers, the heuristic is wrong.

## Task 1.3: Score existing inference rules

**Files:**
- Read: `src/lib/signals/inference.ts` (existing rule definitions)
- Create: `scripts/analytics/calibrate-rules.mjs`

The Aisles inference engine has rules like `returning-shopper-apparel: weight 0.7, hunter:+0.21`. Each rule has preconditions (matches a signal pattern) and an adjustment vector (changes per-persona probabilities). Calibration measures: of all sessions where rule X fires, what fraction had ground-truth persona Y?

- [ ] **Step 1: Reify each inference rule as a JS function**

Port each rule from `inference.ts` into a function `(session) => boolean` that returns true if the rule's preconditions match. Reuse the existing rule names.

- [ ] **Step 2: For each rule, compute precision per persona**

For each rule R and persona P:
- `support[R]` = number of sessions where R fires
- `correct[R][P]` = number of sessions where R fires AND ground-truth = P
- `precision[R][P] = correct[R][P] / support[R]`

Filter to sessions where ground-truth is not "unknown" (the rule needs something to predict against).

- [ ] **Step 3: Output `data/sleepcountry-calibration.json`**

```json
{
  "totalSessions": 11633,
  "labeledSessions": 3500,
  "rules": [
    {
      "name": "returning-shopper-apparel",
      "support": 421,
      "predictedPersona": "hunter",
      "actualPersonaDistribution": {"hunter": 0.18, "researcher": 0.42, "gatherer": 0.31, "gifter": 0.09},
      "precision": 0.18,
      "verdict": "low — predicts hunter but actually gathers researcher most often. KILL or REWEIGHT."
    }
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/analytics/calibrate-rules.mjs data/sleepcountry-calibration.json
git commit -m "feat(analytics): calibrate Aisles inference rules against Sleep Country sessions"
```

(Note: `data/sleepcountry-calibration.json` is in `data/` which is gitignored. The `git add` will fail; either move calibration JSON to `docs/spikes/sleepcountry-calibration/` or accept that the report.md captures the findings and the raw JSON stays local.)

## Task 1.4: Calibration report + ADR-011

**Files:**
- Create: `docs/spikes/sleepcountry-calibration/REPORT.md`
- Create: `docs/architecture/decisions/011-sleepcountry-calibrated-rules.md`
- Modify: `docs/architecture/decisions/README.md` (add row for 011)

- [ ] **Step 1: Write the report**

Skeleton:

```markdown
# Sleep Country Calibration Report

**Date:** 2026-MM-DD
**Dataset:** 29,874 events / 11,633 sessions, Feb 7 – Mar 27, 2026

## TL;DR
_(How many rules transferred? How many failed? Recommendation.)_

## Methodology
- Fingerprinting heuristic: ...
- Ground-truth coverage: N/11,633 sessions labeled (~M%)

## Per-rule findings
_(Table of rule name × support × predicted persona × actual persona × verdict)_

## Recommendations
- KILL: rules whose precision is at or below the persona's base rate
- REWEIGHT: rules whose direction is right but magnitude is off
- ADD: behavioral patterns the existing rules miss (e.g., "session arrives from `instagram.com` and immediately searches a brand name" → researcher)
```

- [ ] **Step 2: Write ADR-011**

```markdown
# ADR-011: Sleep Country inference rules calibrated against real sessions

**Date:** 2026-MM-DD
**Status:** Accepted
**Layer:** engine

## Context
Aisles' persona-inference rules were hand-authored for off-price apparel
(Bealls). Before applying them to sleep retail (Sleep Country), we
calibrated against 11,633 real sessions.

## Decision
[Outcome of calibration: rules retained, killed, added.]

## Consequences
- New rules in `src/lib/signals/inference.ts` (in a follow-on commit)
- Sleep Country brand uses these rules; Bealls/BF/HC keep theirs (rule
  set is brand-scoped via the existing rule context)
- Calibration is reproducible: rerun `scripts/analytics/calibrate-rules.mjs`
  with new data anytime
```

- [ ] **Step 3: Commit + push**

```bash
git add docs/spikes/sleepcountry-calibration/REPORT.md \
        docs/architecture/decisions/011-sleepcountry-calibrated-rules.md \
        docs/architecture/decisions/README.md
git commit -m "docs(adr): ADR-011 calibrated sleep retail inference rules"
git push
```

## Task 1.5: Apply calibration findings (optional, scope-dependent)

If the calibration report says "existing rules are fine" — skip. If it says "kill 3, reweight 2, add 4" — open a follow-on commit modifying `src/lib/signals/inference.ts` to add a `sleepcountry`-scoped rule set. Existing rules stay scoped to bealls/bf/hc.

This task is sized as 0.5 day if surgery is needed, 0 days if not.

---

# Stream 2 — Cohort priors at session start

**Goal:** Replace the uniform persona prior with cohort-aware priors derived from the same fingerprinted dataset. Visitors entering via "Meta paid social, prospecting Bloom" get a researcher-heavy prior on their very first request, before any signals fire.

**Estimated effort:** 3 days active.

**Depends on:** Stream 1 Task 1.2 (fingerprinted JSONL) at minimum. Stream 1 Task 1.4 (calibration findings) optionally — if calibration shows our fingerprinting was wrong, fix it before deriving priors.

## Task 2.1: Derive cohort priors

**Files:**
- Create: `scripts/analytics/derive-cohort-priors.mjs`
- Create: `data/sleepcountry-cohort-priors.json`

- [ ] **Step 1: Define cohort dimensions**

Each session has an entry context: `(referrer_domain, postal_prefix, hour_of_day)`. Bucket dimensions:
- `referrer`: enum of `internal`, `google`, `facebook`, `instagram`, `youtube`, `dormezvous` (sister brand), `direct` (no referrer), `other`. Without `utm_medium` we conflate organic and paid social inside `facebook` / `instagram` — accept the noise; the persona priors will absorb whichever skew dominates the cohort.
- `postal_prefix`: keep as-is (3-char FSA) but only if it has ≥30 sessions; otherwise bucket as `other`
- `hour_bucket`: `morning (6-11)`, `afternoon (12-17)`, `evening (18-22)`, `late (23-5)`

- [ ] **Step 2: Aggregate persona distribution per cohort**

For each unique cohort tuple `(referrer × postal_prefix × hour_bucket)`:
- Count sessions with that entry context
- Of those, count sessions per fingerprinted persona (excluding "unknown")
- Compute `prior[persona] = personaCount / totalLabeled` for the cohort
- Smooth: cohorts with <20 labeled sessions fall back to the parent dimension's prior (drop postal_prefix → drop hour_bucket → drop referrer → uniform)

- [ ] **Step 3: Output `data/sleepcountry-cohort-priors.json`**

```json
{
  "version": "2026-05-06",
  "default": { "researcher": 0.35, "hunter": 0.25, "gatherer": 0.30, "gifter": 0.10 },
  "cohorts": [
    {
      "match": { "referrer": "facebook" },
      "support": 565,
      "prior": { "researcher": 0.55, "hunter": 0.30, "gatherer": 0.10, "gifter": 0.05 }
    },
    {
      "match": { "referrer": "internal", "hour_bucket": "evening" },
      "support": 4823,
      "prior": { "researcher": 0.40, "hunter": 0.30, "gatherer": 0.25, "gifter": 0.05 }
    }
  ]
}
```

- [ ] **Step 4: Commit (only the script — JSON is in gitignored data/)**

Optionally: copy the prior JSON into `docs/spikes/sleepcountry-calibration/cohort-priors.json` to capture the snapshot in git for trace.

## Task 2.2: Neon table for cohort priors

**Files:**
- Create: `migrations/2026-05-06-cohort-priors.sql`
- Modify: `src/lib/server/db.ts` (no change expected, just confirm the schema works with the existing Neon HTTP client)

- [ ] **Step 1: Schema**

```sql
CREATE TABLE IF NOT EXISTS cohort_priors (
  id SERIAL PRIMARY KEY,
  brand_id TEXT NOT NULL,
  match_referrer TEXT,
  match_postal_prefix TEXT,
  match_hour_bucket TEXT,
  prior_researcher REAL NOT NULL,
  prior_hunter REAL NOT NULL,
  prior_gatherer REAL NOT NULL,
  prior_gifter REAL NOT NULL,
  support INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX cohort_priors_brand_match ON cohort_priors (brand_id, match_referrer, match_postal_prefix, match_hour_bucket);
```

NULL match columns are wildcards. Most-specific match wins (count of non-null match columns).

- [ ] **Step 2: Apply migration**

```bash
psql "$DATABASE_URL" -f migrations/2026-05-06-cohort-priors.sql
```

(Or via Neon's web SQL editor.)

## Task 2.3: Load priors into Neon

**Files:**
- Create: `scripts/analytics/load-cohort-priors.mjs`

- [ ] **Step 1: Read JSON, INSERT rows**

```js
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const data = JSON.parse(fs.readFileSync('data/sleepcountry-cohort-priors.json'));

await sql`DELETE FROM cohort_priors WHERE brand_id = 'sleepcountry'`;

// default prior with all match columns NULL
await sql`INSERT INTO cohort_priors (brand_id, prior_researcher, prior_hunter, prior_gatherer, prior_gifter, support) VALUES ('sleepcountry', ${data.default.researcher}, ${data.default.hunter}, ${data.default.gatherer}, ${data.default.gifter}, 0)`;

// per-cohort priors
for (const c of data.cohorts) {
  await sql`INSERT INTO cohort_priors (brand_id, match_referrer, match_postal_prefix, match_hour_bucket, prior_researcher, prior_hunter, prior_gatherer, prior_gifter, support) VALUES (...)`;
}
```

- [ ] **Step 2: Run + verify**

```bash
node scripts/analytics/load-cohort-priors.mjs
psql "$DATABASE_URL" -c "SELECT count(*), brand_id FROM cohort_priors GROUP BY brand_id;"
```

Expected: `sleepcountry | <cohort count + 1>`.

## Task 2.4: Engine integration

**Files:**
- Modify: `src/lib/signals/inference.ts` (cold-start prior lookup)
- Modify: `src/lib/signals/request.ts` (pass entry context to inference)
- Modify: `src/lib/server/db.ts` (add `getCohortPrior(brandId, ctx)` helper)

- [ ] **Step 1: New DB helper**

```ts
// src/lib/server/db.ts
export async function getCohortPrior(brandId: string, ctx: {
  referrer?: string;
  postalPrefix?: string;
  hourBucket?: string;
}) {
  const sql = getDb();
  const rows = await sql`
    SELECT prior_researcher, prior_hunter, prior_gatherer, prior_gifter,
           (CASE WHEN match_referrer IS NULL THEN 0 ELSE 1 END +
            CASE WHEN match_postal_prefix IS NULL THEN 0 ELSE 1 END +
            CASE WHEN match_hour_bucket IS NULL THEN 0 ELSE 1 END) AS specificity
    FROM cohort_priors
    WHERE brand_id = ${brandId}
      AND (match_referrer IS NULL OR match_referrer = ${ctx.referrer ?? null})
      AND (match_postal_prefix IS NULL OR match_postal_prefix = ${ctx.postalPrefix ?? null})
      AND (match_hour_bucket IS NULL OR match_hour_bucket = ${ctx.hourBucket ?? null})
    ORDER BY specificity DESC, support DESC
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    researcher: Number(r.prior_researcher),
    hunter: Number(r.prior_hunter),
    gatherer: Number(r.prior_gatherer),
    gifter: Number(r.prior_gifter),
  };
}
```

- [ ] **Step 2: `request.ts` extracts entry context**

When `createStoreFromRequest` is called, derive the entry context from the request `Referer` header (bucket via the same enum as Task 2.1), the `aisles_postal` cookie (if present), and the current hour. UTM params are no longer in the cohort key.

- [ ] **Step 3: `inference.ts` cold start uses the prior**

In `infer()`, before applying signal rules: if `signalCount === 0` (no signals from this session yet), seed `probabilities` from `getCohortPrior(brandId, ctx)` instead of the uniform `{ researcher: 0.25, hunter: 0.25, gatherer: 0.25, gifter: 0.25 }`. If the lookup returns null, fall back to uniform.

Expose the cohort match in the inference result so the dev panel can show "primed by cohort: meta_paid + cpc (support 565)".

- [ ] **Step 4: Build, deploy to sleepcountry, smoke**

```bash
VITE_BRAND_ID=sleepcountry npm run build
npx wrangler deploy --env sleepcountry
```

Open `aisles-demo-4.biq.workers.dev/?dev=1` with a fake `Referer: https://www.facebook.com/` (use the dev-toolbar referrer override, or `curl -H 'Referer: https://www.facebook.com/' ...`). The inference panel should show a researcher-biased prior even before any clicks.

- [ ] **Step 5: Commit + push**

```bash
git add migrations/ scripts/analytics/load-cohort-priors.mjs \
        src/lib/server/db.ts src/lib/signals/request.ts src/lib/signals/inference.ts
git commit -m "feat(engine): cohort-aware persona priors at session start (sleepcountry-only)"
git push
```

## Task 2.5: Re-evaluate against fingerprinted data

- [ ] **Step 1: Holdout evaluation**

Split the 11,633 sessions 80/20 (training/holdout). Re-derive priors from the 80% slice. For each session in the 20% holdout, compute the prior at its entry context and compare to its actual fingerprinted persona. Compute log-likelihood improvement vs uniform prior.

If improvement is meaningful (e.g., >10% log-likelihood lift), the priors are pulling weight. If not, the cohort dimensions don't carry signal — drop the feature, document why.

- [ ] **Step 2: Document in calibration report**

Append a section to `docs/spikes/sleepcountry-calibration/REPORT.md` covering the holdout evaluation.

---

# Stream 3 — Dev-mode session replay (the demo feature)

**Goal:** A new dev-toolbar feature lets the operator pick a real (anonymized) session from a curated dropdown, click "Replay," and watch the Aisles UI navigate through that shopper's actual journey while the engine reacts in real time. Each replay is reproducible, ground-truth-labeled, and tells a clear story.

**Estimated effort:** 1.5 days active.

**Depends on:** Stream 1 Task 1.2 (fingerprinted sessions) for picking representatives.

**This is the audience-facing demo feature.** Streams 1 and 2 strengthen the engine; Stream 3 is what stakeholders see.

## What it looks like

When dev mode is on, the existing Inference Engine panel gets a new "Replay" section:

```
┌────────────────────────────────────────────────────────────────┐
│ ● DEV — INFERENCE ENGINE · /category/mattresses · researcher   │
├────────────────────────────────────────────────────────────────┤
│ ...standard panel content...                                   │
│                                                                │
│ ▾ Session replay                                               │
│   Pick a real (anonymized) shopper journey to replay:          │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │ Researcher comparing 4 mattresses          (0:23, 7 ev)  │ │
│   │ Hunter: Meta-prospect → cart                (0:11, 4 ev) │ │
│   │ Gatherer: multi-category browse, no buy     (0:34, 11 ev)│ │
│   │ Gifter: pillow set checkout                 (0:18, 6 ev) │ │
│   │ Returning visitor, postal L6T              (0:42, 14 ev) │ │
│   └──────────────────────────────────────────────────────────┘ │
│   [▶ Replay]   [⏸ Pause]   [⏭ Skip]                           │
│                                                                │
│   Currently playing: "Researcher comparing..."  ●●●○○○○ 3/7   │
│   Next event in 2.1s: SEARCH_PRODUCT "tempur-pedic"           │
└────────────────────────────────────────────────────────────────┘
```

When the operator clicks Replay:
1. The browser navigates to the session's entry path (e.g., `/category/mattresses`) with a synthesized referrer header passed through to the server (via a `?_replay_ref=facebook.com` query param the server reads in dev mode)
2. The fixture's events fire in sequence with realistic delays (compressed: actual minutes → seconds)
3. Each event goes through the existing `/api/signals` endpoint, the inference engine reacts, the panel updates
4. Page navigations occur programmatically (`goto()`) at the appropriate event times
5. The AI layout regenerates as persona shifts during the session

Audience effect: they see the engine adapt in real time to a real shopper's journey. The persona panel updates live; the layout regenerates between events; the cumulative effect is "the engine is alive and responding."

## Task 3.1: Curate session fixtures

**Files:**
- Create: `data/sleepcountry-replay-sessions.jsonl` (full set, gitignored)
- Create: `static/dev-fixtures/replay-sessions.json` (curated subset, ~12 sessions, in repo + bundled into client)

- [ ] **Step 1: Filter the fingerprinted JSONL to "demoable" sessions**

Criteria for demoable:
- 5–15 events (long enough to be interesting, short enough to replay in <2 min compressed)
- Confidence ≥ 0.7 (clear ground-truth label)
- Event mix: at least 1 of each of (`SHOPPER_PAGE_VIEWED`, `PRODUCT_PAGE_VIEWED`, and ideally `SEARCH_PRODUCT` or `SHOPPER_CART_*`)

```bash
node scripts/analytics/filter-demoable.mjs \
  --input data/sleepcountry-fingerprinted.jsonl \
  --output data/sleepcountry-demoable.jsonl
```

- [ ] **Step 2: Pick 12 sessions across all 4 personas + a few "interesting" ones**

3 sessions per main persona (researcher, hunter, gatherer, gifter) + a returning-visitor case + a persona-shift case (started gatherer, became hunter). Each one tells a distinct story.

For each picked session, write a hand-curated `label` and `narrative` line. Save to `static/dev-fixtures/replay-sessions.json`:

```json
[
  {
    "id": "researcher-bloom-comparison",
    "label": "Researcher comparing 4 Bloom mattresses",
    "narrative": "Real shopper from a Meta paid-social ad, spent 23 minutes comparing premium Bloom models, didn't buy. The engine should pick this up immediately.",
    "groundTruthPersona": "researcher",
    "entry": {
      "path": "/products/bloom-air-mattress.html",
      "referrer": "instagram.com",
      "postal_prefix": "L6T"
    },
    "events": [
      { "atSecondsFromStart": 0, "type": "PRODUCT_PAGE_VIEWED", "path": "/products/bloom-air-mattress.html" },
      { "atSecondsFromStart": 4, "type": "SHOPPER_PAGE_VIEWED", "path": "/mattresses" },
      { "atSecondsFromStart": 8, "type": "PRODUCT_PAGE_VIEWED", "path": "/products/bloom-river-mattress.html" },
      { "atSecondsFromStart": 13, "type": "SEARCH_PRODUCT", "query": "memory foam comparison" },
      { "atSecondsFromStart": 18, "type": "PRODUCT_PAGE_VIEWED", "path": "/products/bloom-cloud-mattress.html" },
      { "atSecondsFromStart": 22, "type": "PRODUCT_PAGE_VIEWED", "path": "/products/bloom-mist-mattress.html" }
    ]
  }
  // ... 11 more
]
```

Real timestamps are hour-bucketed in the source data, so we approximate intra-session timing by event ordering at uniform-ish spacing. Compress all sessions to fit within 30-60 seconds of replay time.

- [ ] **Step 3: Map source paths to Aisles paths**

Sleep Country's URLs (`/products/bloom-air-mattress.html`) don't match Aisles' URL structure. Map per session:
- `/mattresses` → Aisles `/category/mattresses`
- `/products/bloom-air-mattress.html` → an actual Aisles product (e.g., `/product/SC-MAT-001`) — pick the closest match by name from our seeded catalog
- `/` stays `/`
- Search queries pass through to Aisles' `/search?q=...` if it has one, else just emit the SEARCH_PRODUCT signal without nav

- [ ] **Step 4: Commit the curated subset**

```bash
git add static/dev-fixtures/replay-sessions.json
git commit -m "data(dev): curated replay-session fixtures derived from sleepcountry analytics"
```

## Task 3.2: Replay engine (frontend)

**Files:**
- Create: `src/lib/dev/session-replay.svelte.ts` (state machine: pick → playing → paused → ended)
- Create: `src/lib/components/dev/SessionReplayPicker.svelte`
- Modify: `src/lib/components/dev/InferenceEnginePanel.svelte` (mount picker + status)

- [ ] **Step 1: State machine module**

```ts
// src/lib/dev/session-replay.svelte.ts
import { goto } from '$app/navigation';
import { getEmitter } from '$lib/signals/emitter';

interface ReplaySession { /* ...from fixture... */ }

let sessions = $state<ReplaySession[]>([]);
let active = $state<{ session: ReplaySession; nextEventIdx: number; startedAt: number; timer: number | null } | null>(null);

export async function loadSessions() {
  if (sessions.length > 0) return;
  const res = await fetch('/dev-fixtures/replay-sessions.json');
  sessions = await res.json();
}

export function listSessions() { return sessions; }

export function startReplay(id: string) {
  if (active) stopReplay();
  const session = sessions.find((s) => s.id === id);
  if (!session) return;

  // Navigate to entry path with synthesized referrer attached.
  // The server-side request handler reads `_replay_ref` in dev mode and treats it as the
  // session's effective Referer for cohort-prior lookup. UTM params are no longer in scope.
  const url = new URL(session.entry.path, window.location.origin);
  if (session.entry.referrer) url.searchParams.set('_replay_ref', session.entry.referrer);
  if (session.entry.postal_prefix) url.searchParams.set('_replay_postal', session.entry.postal_prefix);
  goto(url.pathname + url.search);

  active = { session, nextEventIdx: 0, startedAt: Date.now(), timer: null };
  scheduleNextEvent();
}

function scheduleNextEvent() {
  if (!active) return;
  const evt = active.session.events[active.nextEventIdx];
  if (!evt) {
    active = null;
    return;
  }
  const elapsed = (Date.now() - active.startedAt) / 1000;
  const wait = Math.max(0, evt.atSecondsFromStart - elapsed) * 1000;
  active.timer = window.setTimeout(() => {
    fireEvent(evt);
    if (active) {
      active.nextEventIdx++;
      scheduleNextEvent();
    }
  }, wait);
}

async function fireEvent(evt: ReplayEvent) {
  // Translate to Aisles event type
  const emitter = getEmitter();
  if (!emitter) return;
  switch (evt.type) {
    case 'PRODUCT_PAGE_VIEWED':
      goto(evt.path);
      emitter.emit('view.pdp', { path: evt.path });
      break;
    case 'SHOPPER_PAGE_VIEWED':
      goto(evt.path);
      emitter.emit('view.surface', { path: evt.path });
      break;
    case 'SEARCH_PRODUCT':
      emitter.emit('interact.search', { query: evt.query });
      break;
    case 'SHOPPER_CART_CREATED':
    case 'SHOPPER_CART_UPDATED':
      emitter.emit('interact.cart_event', { type: evt.type });
      break;
    // ... etc
  }
}

export function stopReplay() {
  if (active?.timer) clearTimeout(active.timer);
  active = null;
}

export function getReplayStatus() {
  if (!active) return null;
  return {
    sessionId: active.session.id,
    label: active.session.label,
    progress: active.nextEventIdx / active.session.events.length,
    nextEvent: active.session.events[active.nextEventIdx] ?? null,
  };
}
```

- [ ] **Step 2: Picker component**

```svelte
<!-- src/lib/components/dev/SessionReplayPicker.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { loadSessions, listSessions, startReplay, stopReplay, getReplayStatus } from '$lib/dev/session-replay.svelte';

  let selected = $state<string>('');

  onMount(() => { loadSessions(); });

  const sessions = $derived(listSessions());
  const status = $derived(getReplayStatus());
</script>

<div class="replay-section">
  <details>
    <summary>▸ Session replay</summary>

    <div class="picker">
      <select bind:value={selected}>
        <option value="">Pick a session...</option>
        {#each sessions as s}
          <option value={s.id}>{s.label} ({s.events.length} events)</option>
        {/each}
      </select>

      {#if status}
        <button onclick={stopReplay}>⏹ Stop</button>
      {:else}
        <button onclick={() => selected && startReplay(selected)} disabled={!selected}>▶ Replay</button>
      {/if}
    </div>

    {#if status}
      <div class="status">
        Playing: <strong>{status.label}</strong>
        — progress: {Math.round(status.progress * 100)}%
        {#if status.nextEvent}
          — next: <code>{status.nextEvent.type}</code>
        {/if}
      </div>
    {/if}
  </details>
</div>

<style>/* ...inline match the panel's dark theme... */</style>
```

- [ ] **Step 3: Mount inside InferenceEnginePanel**

In `src/lib/components/dev/InferenceEnginePanel.svelte`, add the picker below the existing override controls.

- [ ] **Step 4: Build + deploy**

```bash
VITE_BRAND_ID=sleepcountry npm run build
npx wrangler deploy --env sleepcountry
```

## Task 3.3: Smoke + iteration

- [ ] **Step 1: Open `aisles-demo-4.biq.workers.dev/?dev=1`, expand the dev panel**

Pick "Researcher comparing 4 Bloom mattresses". Click Replay. Expected:
- Browser navigates to `/category/mattresses?_replay_ref=instagram.com&_replay_postal=L6T`
- Within 5 seconds: persona inference shifts toward researcher (the Stream 2 cohort prior should already be biased that way; signal rules then reinforce)
- AI layout for `/category/mattresses` regenerates with researcher-styled copy
- Page navigates to product pages as the events fire
- Replay completes; panel shows "ended"

- [ ] **Step 2: Tune timing if too fast / too slow**

Compress factor is intentional — real shopper sessions are minutes, our replay needs to be seconds. ~2-3 seconds between events feels like a watchable demo. Adjust the `atSecondsFromStart` values in the fixture.

- [ ] **Step 3: Add a "narrative pop-up"**

When a replay starts, show a small toast at the top of the screen with the session's narrative ("Real shopper from a Meta paid-social ad, spent 23 minutes comparing..."). Helps orient demo audiences.

- [ ] **Step 4: Capture demo recording**

Run a Playwright script that opens the URL with each session id pre-selected, replays, captures video. Output: `docs/audits/sleepcountry-replay-demos/*.mp4`. Useful for sales decks.

- [ ] **Step 5: Commit + push**

```bash
git add src/lib/dev/session-replay.svelte.ts src/lib/components/dev/SessionReplayPicker.svelte src/lib/components/dev/InferenceEnginePanel.svelte
git commit -m "feat(dev): session-replay picker — replay anonymized real shopper journeys"
git push
```

---

## Self-review

- [ ] Each stream has a clear goal and an outcome (Stream 1 = report, Stream 2 = runtime change, Stream 3 = demo feature).
- [ ] Stream dependencies are explicit: 1 → 2 (priors derive from fingerprinting), 1 → 3 (replay sessions are picked from fingerprinted set), 2 → 3 (priors make replay opening sequence more dramatic).
- [ ] Data files stay out of git (gitignored `data/`); curated subsets land in repo (`static/dev-fixtures/`, `docs/spikes/`).
- [ ] No runtime dependencies added — Neon (already used), Svelte (already used), and the existing emitter/inference modules are reused.
- [ ] Calibration is non-destructive — produces a report, optionally lands rule changes in a separate scoped commit.
- [ ] No emoji.
- [ ] No placeholders ("TBD", "fill in later") — every step has actual content.

## Estimated calendar

| Phase | Tasks | Active work | Calendar |
|---|---|---|---|
| Stream 1 (calibration) | 1.1 – 1.4 (1.5 optional) | 1 day | 1-2 days |
| Stream 2 (cohort priors) | 2.1 – 2.5 | 3 days | 4-5 days (Neon migration is fast but verification takes time) |
| Stream 3 (session replay) | 3.1 – 3.3 | 1.5 days | 2 days |
| **Total (sequential)** | | **5.5 days active** | **~2 weeks calendar** |

Streams 1 and 3 can run in parallel after Task 1.2. Stream 2 must wait for Stream 1 to complete. So with two-track work: ~5 days calendar.

## Out of scope for this plan

- Bealls/BF/HC calibration — would require their own session-event datasets. Aisles team's BQ doesn't currently capture them.
- Real-time BQ querying from Workers — keep BQ offline; runtime reads from Neon. (See discussion under "BigQuery — what NOT to do" in earlier conversation.)
- Engine-layer prompt rewrites — calibration may suggest rule changes; prompt-engineering work is a separate track (per ADR-006 + ADR-008).
- Session-replay feature for Bealls/BF/HC — works in principle but needs their session data. Currently sleepcountry-only.
- Multi-brand cohort priors — `cohort_priors.brand_id` allows multi-brand storage, but the loader only populates sleepcountry. Bealls/BF/HC stay on uniform priors until their data lands.

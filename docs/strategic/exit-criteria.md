# Aisles — Exit Criteria

**Version**: 0.4.0
**Last Updated**: 2026-05-01
**Audience**: commerce.com internal teams + project lead
**Companion to**: [`NORTH-STAR.md`](NORTH-STAR.md), [`STRATEGY.md`](STRATEGY.md), [`risks.md`](risks.md)

This doc defines what ends the Aisles experiment. Without these criteria, "what's next?" recurs indefinitely because there is no defined endpoint. The BigBlueprint pipeline (Stage 7, Iterate) and the Atelier canonical-state model both assume an exit; this doc names ours.

---

## 1. What "experiment done" looks like

Three conditions, all required.

### 1.1 Cold-audience evidence

**≥3 cold-audience walk-throughs landed**, at least one per internal audience (product / engineering / customer success), each with a bring-back artifact logged in `docs/strategic/walkthroughs/runs/`.

A run counts as "cold" if:
- The audience is someone other than the project lead playing a role
- The bring-back artifact is authored by the audience, not the project lead
- The artifact follows the template from [`BRD.md`](../functional/BRD.md) §1

If 2026-08-01 arrives without §1.1 met, that is itself the finding — RISK-07 (vanity demo) materialized; disposition becomes [§3.1 frozen](#31-frozen-default-if-no-disposition-decision-is-forced) with the no-cold-runs outcome documented.

### 1.2 Three-hypothesis evaluation

A written evaluation of each hypothesis from [`STRATEGY.md`](STRATEGY.md) §3:

- **H1** — Schema-typed generative composition is production-viable — supported / contested / inconclusive
- **H2** — Bundling engine + foundation + admin changes outcomes — supported / contested / inconclusive
- **H3** — BC-native packaging reaches merchants — supported / contested / inconclusive

Each evaluation cites specific walk-through bring-back artifacts as evidence. Lives at `docs/strategic/findings.md` (created at exit time).

### 1.3 Disposition decision

An explicit decision (project lead + at least one product-leadership stakeholder) on what happens to the artifact next. Three valid dispositions, named in §3.

---

## 2. Time-box

The experiment runs until either:

- All three exit conditions in §1 are met, **OR**
- **2026-08-01** (90 days from this doc's date)

Time-box extension past 2026-08-01 requires an explicit decision — not implicit drift. See §5.

---

## 3. Disposition options

After exit conditions are met, the artifact takes one of three paths.

### 3.1 Frozen (default if no disposition decision is forced)

- Artifact left running on existing Vercel deployments
- No further development
- Accessible for ad-hoc reference (teams who want to revisit findings)
- Operational cost continues until manually decommissioned
- Canonical-state docs remain authoritative

### 3.2 Handed off

- Artifact ownership transfers (likely target: commerce.com platform team, OR a product team adopting one of the patterns surfaced — e.g., V-invariant adoption per engineering bring-back)
- Code may be folded into production codebases (specific patterns, not the artifact wholesale)
- Documents become reference for the new owner
- Bealls engagement closed cleanly with explicit deliverable

### 3.3 Productization conversation initiated

- **Separate process** — NOT a continuation of the experiment
- Triggered by leadership read of findings + external market signal
- Requires new commitments: budget, team, GTM, pricing, BC marketplace listing path
- Bealls relationship may continue as design partner under separate scope

**Default if no disposition decision is reached by 30 days post-exit (i.e., 2026-08-31): [§3.1 frozen](#31-frozen-default-if-no-disposition-decision-is-forced).** This avoids indefinite drift if leadership conversations stall.

---

## 4. What's deliberately out

- The experiment carries **no implicit commitment to productize Aisles as a sellable product**. Findings could support productization, oppose it, or be inconclusive — and any of those are valid outcomes.
- The experiment is **not a deal-closing motion for Bealls**. Bealls is the example merchant artifact source; the engagement may close cleanly at any disposition.
- **"Production-readiness" of the artifact is not an exit criterion.** Aisles is a possibility prototype; it does not need to be production-grade to surface findings. Don't mistake completing every Phase 1–6 capability for completing the experiment.
- **Number of demonstrated capabilities is not an exit criterion.** Capability count and learning yield are independent. An artifact that demonstrates 25 capabilities and produces 3 cold-run findings has met exit; one that demonstrates 80 capabilities and produces 0 cold-run findings has not.

---

## 5. Decision authority

| Decision | Authority |
|---|---|
| Whether §1 conditions are met | Project lead, with bring-back artifacts as evidence |
| Which disposition path (§3.1 / §3.2 / §3.3) | Project lead + at least one product-leadership stakeholder |
| Whether to extend time-box past 2026-08-01 | Same — explicit, not implicit drift |
| Whether RISK-07 (vanity demo) has materialized early | Project lead, with the 2026-06-01 checkpoint as the trigger |

---

## 6. Checkpoints

In addition to the existing scheduled agents (2026-05-08 sponsor-status, 2026-05-14 walk-through bifurcation), two project-level checkpoints are scheduled between now and 2026-08-01:

- **2026-06-01 (30 days)** — Project-lead review of cold-run progress.
  - If ≥1 cold run landed → on track; continue.
  - If 0 cold runs landed → escalate; consider whether the sponsor-cadence framing is wrong (the structural question surfaced 2026-05-01) and revise pitches OR move to early disposition §3.1.

- **2026-08-01 (90 days)** — Exit point. Evaluate §1 conditions. Trigger §3 disposition.

The 06-01 checkpoint is a meta-checkpoint on the experiment's structure, not just its progress. If RISK-07 is materializing, naming it at 60 days lets us close cleanly rather than drift to the 90-day deadline.

---

## 7. What this exit criteria deliberately does NOT specify

- **Capability cutoffs.** The 6-phase build sequence (STRATEGY §7) may continue past exit if findings warrant; or it may stop early if findings are sufficient. Build sequence and experiment exit are decoupled.
- **Iteration on findings.** If walk-throughs produce strong signal mid-experiment that warrants artifact change, that is a build-sequence decision, not an exit-criteria decision. Don't conflate "iterate on the artifact based on bring-back" with "extend the experiment."
- **Communication plan.** How findings are surfaced to the broader commerce.com org is downstream of the disposition decision (§3) and out of scope here.

---

## 8. Related documentation

- [`NORTH-STAR.md`](NORTH-STAR.md) — what Aisles is (the experiment's content)
- [`STRATEGY.md`](STRATEGY.md) — three hypotheses; this doc's §1.2 evaluates them
- [`risks.md`](risks.md) — RISK-07 (vanity demo) is the dominant exit risk
- [`../functional/BRD.md`](../functional/BRD.md) — walk-through stories that produce §1.1 evidence
- [`../functional/PRD.md`](../functional/PRD.md) — capability registry; not an exit criterion
- [`../../traceability.json`](../../traceability.json) — trace IDs referenced in findings
- [`walkthroughs/`](walkthroughs/) — where walk-through templates and runs live

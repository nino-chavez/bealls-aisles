# BRD Open Questions

**Version**: 0.4.0
**Last Updated**: 2026-04-30

Open items that block or shape stories in [`BRD.md`](BRD.md). Resolved items move to a "Resolved" section with the resolution + date. Add items as they surface — don't let them die in chat threads.

---

## Open

### Q-001 — Rule conflict resolution model

When two merchant rules target the same engine input or layout zone, how does the engine resolve the conflict? Options: first-write-wins, priority field, visual conflict resolver, or escalate-to-merchant.

**Affects:** STORY-005 (Decisions Inspector), STORY-007 (cache key with rule version), PRD-ADM-007 (rule weight tuning).

**Status:** open. Resolution required before Phase 4 ships, since the Decisions Inspector must explain conflict resolution clearly.

---

### Q-002 — `for-you-row` content scoping

Is the personalized recommendation row scoped per-session (cookie), per-shopper-cookie (returning), or per-logged-in-account?

**Affects:** STORY-001 (persona model fit) edge cases, PRD-FND-009 (account dashboard), future personalization capabilities.

**Status:** open. Affects how cold-start handles cookie-only known shoppers.

---

### Q-003 — Loyalty state at family-of-brands level vs. per-brand

Bealls has three brands with shared loyalty (Bealls Bucks). Do we model loyalty state at the family level (one wallet, three brands debit it) or per-brand with sync (cleaner schema, harder UX)?

**Affects:** STORY-020 (Bealls Bucks loyalty walk-through), PRD-ENG-015 (cart composition), PRD-FND-009 (account dashboard).

**Status:** open. Resolution required before Phase 1 ships PRD-FND-009.

---

### Q-004 — Audit log scope

Should the admin audit log capture every change (rule edit, content edit, cache invalidation, RBAC change, login) or only changes that affect runtime engine behavior?

**Affects:** PRD-ADM-010 (RBAC), PRD-ADM-007 (rule tuning), STORY-013 (Bealls property mapping for audit needs).

**Status:** open. Influences ADR-007 (when authored) on multi-tenancy and audit shape.

---

### Q-005 — H3 dedicated demonstration phase?

H3 (BC-native packaging reaches merchants) currently has thin coverage in the demonstration sequence — only 4 demonstrated capabilities, 4 planned. Should there be a dedicated phase that exercises the BC marketplace listing, native auth, and embedded admin?

**Affects:** STORY-008 (multi-brand pattern), STORY-013 (Bealls property generalization), the hypothesis-coverage matrix in PRD §4.

**Status:** open. Decision driver: do CS team walk-throughs of H1+H2 on Bealls produce enough productization evidence on their own, or do we need a BC-native flow demo to test H3 directly?

---

### Q-006 — Single example merchant vs. two

RISK-08 (Bealls overfitting) suggests a second example merchant in a different vertical. Affordable cost (~5 weeks for fresh research + build per merchant). Cost is real — but so is the risk if all our learnings are Bealls-shaped.

**Affects:** STORY-013 (Bealls property generalization), the demonstration sequence in STRATEGY §7, productization sentiment capture (STORY-017).

**Status:** open. Customer success team has best context to identify candidates if/when we add a second merchant.

---

### Q-007 — Walk-through cadence ownership

BRD §6 specifies a walk-through cadence (quarterly product review, monthly engineering all-hands, weekly CS pre-sales sync). Each requires a sponsor in that audience to actually slot it in.

**Affects:** RISK-07 mitigation (vanity demo).

**Status:** open. Project lead to identify and confirm sponsors per audience.

---

## Resolved

> _empty — items move here with resolution + date when settled._

---

## Related documentation

- [`BRD.md`](BRD.md) — internal-team walk-through stories
- [`PRD.md`](PRD.md) — capabilities demonstrated
- [`../strategic/risks.md`](../strategic/risks.md) — risks that surface BRD open questions

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

### Q-008 — Admin authoring precedence vs. engine output

The Phase 2 zone resolver cascade ([ADR-007](../architecture/decisions/007-section-authoring-model.md)) resolves zone content as **engine → admin → static fallback**. Admin yields to engine. Some merchants may want the inverse — "lock this zone to my content; don't let the AI override it." The current decision is yield-to-engine because admin lock-overrides re-conflate the layers ADR-007 separates, but this is a real merchant-facing question that walk-throughs should test.

**Affects:** STORY-005 (Decisions Inspector), STORY-014 (AI authoring vs. AI assistance preference), [PRD-XLAYER-004](PRD.md) (Admin ↔ Foundation contract), Phase 5 admin authoring.

**Status:** open. Test in CS walk-throughs; if mid-market merchants want lock-overrides, revisit the cascade decision.

---

### Q-009 — Zone catalog versioning

Adding a zone is purely additive (new ID, new schema, new fallback). Renaming or removing a zone is a breaking change for admin-authored content scoped to that zone. As soon as Phase 5 ships and merchants author content, the catalog becomes a stable API the foundation owes them.

Options: (a) implicit versioning (we never break zone IDs; deprecate-and-replace pattern with both alive for migration period), (b) explicit catalog versioning (e.g., `aisles-zones@1.0`; merchants pin to a version; admin shows an upgrade path), (c) defer until first real removal pressure.

**Affects:** [PRD-FND-013](PRD.md), [PRD-XLAYER-004](PRD.md), Phase 5 admin authoring.

**Status:** open. Recommend (a) implicit versioning until a real removal scenario surfaces, but the principle wants formal sign-off before Phase 5 launches.

---

### Q-010 — Per-brand static fallback overrides

Static fallbacks are brand-aware via `getBrand()`. Today this is sufficient — fallbacks read brand-specific config (heroHeadline, top categories, etc.). But Bealls Florida and Home Centric may eventually want **structurally different** fallbacks for the same zone (e.g., HC's `home.hero` is content-mode and should fall back to a locator card, not a photographic hero).

Options: (a) all fallbacks per-zone are functions that branch on `getBrand()` internally (today's shape), (b) per-brand fallback overrides (`fallbacks/bealls-florida/home.ts` shadows the default), (c) declare per-brand fallback in `brand.config.ts`.

**Affects:** [PRD-FND-013](PRD.md), multi-brand work, content-mode brands.

**Status:** open. Don't decide until per-brand divergence is a concrete pain (likely Phase 1 / 2 implementation work surfaces it).

---

## Resolved

> _empty — items move here with resolution + date when settled._

---

## Related documentation

- [`BRD.md`](BRD.md) — internal-team walk-through stories
- [`PRD.md`](PRD.md) — capabilities demonstrated
- [`../strategic/risks.md`](../strategic/risks.md) — risks that surface BRD open questions

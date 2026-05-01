# Aisles — Strategy

**Version**: 0.3.0
**Last Updated**: 2026-04-30
**Audience**: commerce.com product leadership
**Companion to**: [`NORTH-STAR.md`](NORTH-STAR.md), [`risks.md`](risks.md)

NORTH-STAR defines what Aisles is. STRATEGY defines **why this shape, against whom, and what's explicitly out of scope.** Cross-industry research is in [`docs/research/{engine,foundation,admin}/`](../research/) — this doc is the synthesis.

---

## 1. The strategic bet in one sentence

**Aisles bets that BigCommerce-native merchants want a generative storefront — schema-typed AI composition with merchant-explainable behavior — bundled with the table-stakes ecomm app and a control plane, and that no incumbent will offer this combination within the next 12 months.**

If that bet holds, Aisles owns a category. If it fails on any of the three clauses, it collapses into one of four adjacent categories where incumbents are entrenched.

The four collapse modes (and their incumbents):

| If the bet fails on… | Aisles collapses into… | Where Aisles loses |
|---|---|---|
| "Merchants want generative" | An insertion-rule personalization platform | Dynamic Yield, Monetate, Salesforce Personalization |
| "Schema-typed AI matters" | A free-form generative content tool | Builder.io AI, Shopify Magic, Klaviyo K:AI |
| "BC-native bundling matters" | A headless commerce framework with personalization plug-ins | Saleor, commercetools, Vue Storefront |
| "Merchant explainability matters" | A black-box recommender | Algolia Recommend, Coveo, Constructor.io |

Each collapse mode is a real product category with paying customers. Aisles doesn't try to compete in any of them as a follower. The strategy is to occupy the unique position at their intersection.

---

## 2. Why this shape — the four pillars

### 2.1 Generative storefront, not insertion personalization

**Finding (engine research):** Eleven of twelve surveyed personalization platforms top out at insert-at-zone, rank-existing-content, or A/B-between-variants. None generate whole ecomm surfaces as typed component trees. The "generative storefront" lane is empty.

**The bet:** the lane is empty because nobody has solved the correctness/control problem (you can't ship LLM-generated UI to production without a typed schema and a merchant-explainable audit trail), not because merchants don't want it. Once those two unlocks exist, generative composition will be strictly superior to insertion-rule personalization on cold-start, long-tail catalog, and persona transitions — exactly the merchant pain points incumbents solve poorly.

**The hedge:** if the lane is empty because merchants are hostile to generation (the alternative read of the data: Adobe, Klaviyo, Optimizely all chose to use AI to *help author variants*, not *replace* them), then merchant control + explainability is what bridges the gap. The admin layer's Decisions Inspector — "here's what the AI did and why" — is what converts hostile merchants to informed ones.

### 2.2 BC-native bundling as a distribution moat

**Finding (engine research):** Most personalization platforms (DY, Monetate, Salesforce Personalization, Adobe Target, Coveo, Optimizely) reach BigCommerce via tags or system integration. Only the discovery-natives (Algolia, Klevu, Constructor, Bloomreach) ship native BC apps. None of those generate composition.

**Finding (foundation research):** BigCommerce Cornerstone has the broadest default page inventory of any reference theme — ~17 root pages plus 15 account sub-pages. BC merchants already expect brand pages, compare, wishlist, returns, gift certificates, sitemap, and contact as first-class. A BC merchant evaluating Aisles will measure it against Cornerstone, not against Saleor.

**The bet:** a BC-native AI composition layer wins on distribution (one-click marketplace install, no integration project) and on completeness (matches Cornerstone's surface coverage out of the box). This is structurally hard for non-BC-native incumbents to match without re-architecting their stacks for one platform.

**The hedge:** if BC marketplace distribution doesn't deliver merchants at the expected rate, Aisles' moat compresses to "engine quality" — and engine quality is a 12-month head start at most before incumbents catch up. The BC-native commitment must be backed by actual BC integration depth (channels, marketplace app, native auth, native catalog), not just "we work on BC."

### 2.3 Schema-typed AI as the correctness foundation

**Finding (engine research):** Constructor and Algolia type their data; Bloomreach types their CMS; Shopify types their admin via Polaris. None combine typed schema *composition output* with AI generation. The V invariant (`∀I, ∀P, f(I, P) → S ∈ V` — every layout is an element of a finite typed schema) is structurally hard to copy and is the precondition for explainability.

**The bet:** schema-typed output is what makes generative composition shippable. Without it, every layout is a roll of the dice; with it, every layout is auditable, validatable, and testable. Merchants who have been burned by black-box AI recommendations are the most receptive audience.

**The hedge:** a competitor could add schema typing on top of an existing personalization product. The first-mover advantage is architectural — adding the V invariant retroactively requires re-architecting the LLM call path, the cache key, the validation cascade, and the admin observability surface. Estimated 6–9 months of engineering for a follow-on competitor; doable but expensive enough to delay.

### 2.4 Merchant explainability as the trust foundation

**Finding (admin research):** Adobe Target Auto-Personalization, Dynamic Yield Predictive Targeting, and Monetate bandits are black boxes. Merchants see lift but not "why this layout for this user." Sanity's Content Source Maps and Constructor's MIA are the only competitors flirting with explainability, and both are thin.

**Finding (admin research):** The recommended primary daily-driver for `aisles-admin` is a **Decisions Inspector** — "what did the AI just do, and why?" — not a Rules tab. This reframing puts explainability at the center of the merchant workflow.

**The bet:** "Dynamic Yield tells you what won. Aisles tells you why." This is the single most defensible wedge in the admin layer because it's structurally enabled by the V invariant (typed components are explainable; black-box embeddings are not) and structurally hard for incumbents to add without re-architecting.

**The hedge:** explainability is only valuable if merchants actually use it. If merchants want lift and don't care about why, explainability becomes a tax, not a feature. The product must make explainability the path of least resistance — the Inspector is what they open first, not an option buried three clicks deep.

---

## 3. Competitive positioning

Detailed comparisons of all twelve platforms are in [`docs/research/engine/competitive-survey.md`](../research/engine/competitive-survey.md). The strategic summary:

### 3.1 The category map

| Category | Player examples | What they sell | Where Aisles plays |
|---|---|---|---|
| **AI personalization (insert)** | Dynamic Yield, Monetate, Salesforce Personalization, Adobe Target, Optimizely | Insert content blocks at named zones based on rules + AI ranking | Aisles is one layer up — generates the surface, not just inserts into it |
| **AI search + recs** | Algolia, Bloomreach, Coveo, Klevu, Constructor.io | Rank existing catalog content by relevance + recommendations | Aisles uses recs as one input among many; doesn't compete head-on |
| **Generative content tools** | Builder.io AI, Shopify Magic, Klaviyo K:AI, Optimizely Opal | Help humans author variants/copy/segments faster | Aisles generates the variant itself; humans review/override |
| **Headless commerce frameworks** | commercetools Frontend, Saleor, Vue Storefront, Hydrogen | Provide ecommerce primitives; bring your own personalization | Aisles bundles primitives + personalization + admin in one product |
| **Headless CMS + page builders** | Contentful, Sanity, Storyblok, Builder.io | Author content in a typed model; merchants compose pages | Aisles uses a similar typed model but the AI composes, not the merchant |

Aisles sits **at the intersection** of these categories. Each category has incumbents Aisles cannot beat as a follower. Aisles' position only exists because it crosses category boundaries.

### 3.2 Existential competitor: Bloomreach

**Of all surveyed platforms, Bloomreach is the highest competitive risk.** Bloomreach has Loomi (their AI brand), Clarity (agentic chat), Discovery (search/recs), Content (CMS), and Engagement (CDP/email). They are an Elite BigCommerce partner. If Bloomreach's Clarity extends from chat turns to page composition, Aisles' wedge compresses to "BC-native and cheaper" within 12 months.

**Mitigation:** ship the Decisions Inspector and the typed-schema audit trail before Bloomreach's Clarity ships generative composition. Both unlocks are admin-layer-shaped, and Bloomreach's admin (Engagement) is generic CDP UX — they don't have an explainability surface. We can race them on differentiation, not on capability count.

### 3.3 Underestimated competitors

- **Constructor.io** — outcome-trained ranking; will be loud in deals; rank-shaped; stays there. Not an existential threat but every personalization deal will reference them.
- **Adobe Target** — has the deepest auto-personalization stack but is enterprise-priced and not BC-native. Threat only if Adobe ships a mid-market BC integration.
- **Shopify Magic / Sidekick** — adjacent platform but signals "merchants are receptive to AI assistance" trend; reinforces Aisles' bet.

### 3.4 Where Aisles is structurally weak

Honest steel-man assessment, per the engine research:

- **"AI built something we didn't approve."** Incumbents will frame generative composition as a control loss. The admin layer must counter this with preview-before-publish, rule-bound generation, and the Decisions Inspector.
- **"Variant-authoring AI is enough."** Adobe AI Assistant, Klaviyo K:AI, Optimizely Opal explicitly refuse to generate variants and just help authors. Merchants who agree will see Aisles as overreach.
- **"BC-native isn't a moat — we'll add a BC plug-in."** True for any individual incumbent. Aisles' defense is bundling: a single product across engine + foundation + admin is harder to plug-in than any of those individually.
- **"We don't trust LLM-generated UI in production."** The V invariant is the mitigation — every layout is schema-validated; nothing renders that wasn't typed. But this requires merchant education, not just architecture.

---

## 4. What Aisles is not (out of scope)

Explicit non-goals. Each of these is a real product category Aisles could chase but won't, because doing so dilutes the four-pillar position above.

| Non-goal | Why we don't do it | What we use instead |
|---|---|---|
| **Custom checkout flow** | Foundation research consensus: Hydrogen redirects to Shopify Checkout; Cornerstone uses BC Optimized One-Page. Building custom checkout is a separate program with payment-method risk and PCI scope expansion. | Hand off to BC Optimized One-Page Checkout; the engine personalizes upsells, copy, and trust assurances on the way in |
| **Headless CMS for arbitrary content** | Contentful, Sanity, Storyblok own this category. Aisles' content authoring is bounded by the engine's component vocabulary — not free-form. | Admin authors blocks the engine knows how to compose with; arbitrary CMS work goes to a sister product |
| **Email / SMS / push CDP** | Klaviyo, Bloomreach Engagement, Salesforce Marketing Cloud own this. Email touch is downstream of the storefront experience. | Integration only — surface signals to those tools, don't replace them |
| **Subscription commerce** | Recharge, Subbly, BC's native subscriptions own this. Subscription UX is its own surface taxonomy. | Out of scope for V1; revisit once core surface taxonomy is stable |
| **B2B catalogs / negotiated pricing** | commercetools, Spryker, BC B2B own this. B2B is its own composition latitude problem. | Out of scope |
| **Marketplace / multi-seller flows** | Mirakl owns this; BC has its own multi-vendor work. | Out of scope |
| **Real-time personalization < 100ms** | Aisles targets seconds-fresh, not millisecond-fresh. The cache-and-stream architecture means most visitors see a sub-100ms cached layout, but the first generation per (brand, surface, persona, picks-hash) is 5–10s. | Acceptable trade-off for V1; revisit once V1 is in market |
| **Replacing the merchant's payment processor** | BC handles this via integrations. | Use BC's payment integrations; add nothing |
| **Replacing the merchant's analytics platform** | Mixpanel, Amplitude, Segment own this. Aisles' Observe dashboard is operational telemetry for the engine, not behavioral analytics for the merchant's marketing team. | Surface signals and engine telemetry; don't try to be GA |
| **Custom ad targeting / paid media** | Google Ads, Meta Ads own this. The growth-lead persona uses Aisles to *interpret* paid traffic, not to *buy* it. | Out of scope |

---

## 5. Strategic risks

Detailed in [`risks.md`](risks.md). Summary of the four load-bearing bets and their mitigations:

| Risk | Bet | Mitigation |
|---|---|---|
| **RISK-01: AI composition latency** | 5–10s wait acceptable for AI-personalized homepage | Cache-and-stream architecture (already shipped); 95% of visitors see sub-100ms cached layouts |
| **RISK-02: Schema lock-in** | 6 surface schemas cover 90% of ecomm sites | Extension hook in admin to add surface schemas without engine change |
| **RISK-03: Demo→product gap** | Bealls demo translates to commerce.com merchant pitch | Pivot to 2–3 additional reference merchants in Stage 1 research before commit |
| **RISK-04: Merchant authoring complexity** | Merchandisers can author rules without engineer support | Managed services tier + templates per merchant; Decisions Inspector reduces auth complexity by reframing UX from "rules" to "decisions" |

Two new risks surfaced by Stage 1 research:

| Risk | Bet | Mitigation |
|---|---|---|
| **RISK-05: Bloomreach extends Clarity to surface composition** | We ship Decisions Inspector + typed-schema audit before Bloomreach ships generative composition | Race; admin-layer differentiation; 12-month window |
| **RISK-06: Merchants reject "AI built something we didn't approve"** | Decisions Inspector + preview-before-publish + rule-bound generation overcomes resistance | If resistance is structural, Aisles' positioning shifts from "generate" to "compose with strict merchant approval" — a narrower wedge but still defensible |

---

## 6. Sequencing — what gets built first, why

The implementation roadmap is in [`../architecture/engine/composition-taxonomy.md`](../architecture/engine/composition-taxonomy.md) §8. The strategic sequencing rationale:

### Phase 1: Close the 5 missing foundation surfaces

**Per foundation research, Aisles is missing:**
- Account dashboard (orders / addresses / profile)
- Real checkout (vs. stub) — recommendation: hand off to BC Optimized Checkout
- Search results page with facets
- Branded 404 / empty states
- Section authoring model (named insertion zones across all surfaces)

**Why first:** without these, Aisles can't claim "complete ecomm site." Pillar 2 (BC-native bundling) collapses without foundation completeness. **Estimated: ~3 weeks human, ~1 week agent.**

### Phase 2: Define the section authoring model

The single most important foundation finding: every reference theme exposes named, reorderable insertion zones. Aisles must define this contract **before** AI composition work continues, otherwise the AI layer has no target to write into.

**Suggested initial named zones** (per research):
`home.hero`, `home.featured-row.{n}`, `plp.banner`, `plp.empty-state`, `pdp.related`, `pdp.recently-viewed`, `cart.cross-sell`, `search.empty-state`, `account.welcome`.

**Why second:** unblocks Phase 3 PDP/Cart/Checkout AI insertion work. **Estimated: ~1 week human, ~2 days agent.**

### Phase 3: Schema split + PDP/Cart/Checkout composition

Single `LayoutSchema` becomes 6 surface-typed schemas (per [`composition-taxonomy.md`](../architecture/engine/composition-taxonomy.md) §9). PDP gets the 9 mandatory scaffold blocks plus named insertion zones. Cart/Checkout get fixed scaffolds + named upsell/personalization zones.

**Why third:** the schema split is the architectural unlock that prevents prompt drift. Without it, the AI keeps composing free-form on PDP.

**Estimated:** ~2 weeks human, ~5 days agent.

### Phase 4: Decisions Inspector in admin

The single most important admin finding: explainability is the wedge. Build the Decisions Inspector as the admin's daily-driver before adding more rule types.

**Why fourth:** explainability protects against merchant resistance to generative composition (RISK-06) and is the precondition for the "Dynamic Yield tells you what won; Aisles tells you why" positioning (Pillar 4).

**Estimated:** ~3 weeks human, ~1 week agent.

### Phase 5: Workspaces + RBAC in admin

V1 must include role-based access control and multi-brand workspaces. Bealls + agency model demands it from day one. Adopt Contentful's role taxonomy + Adobe Target Workspaces.

**Why fifth:** retrofitting permissions later costs ~10x. Once the Inspector is shipped and the admin daily-driver is stable, RBAC layers cleanly.

**Estimated:** ~2 weeks human, ~5 days agent.

### Phase 6: Locator + BOPIS depth (Bealls-specific value)

Per foundation research, locator is the rare universal gap (only Hyvä ships it default). Combined with PDP pickup-availability (only Dawn ships), this is the most defensible foundation-level investment for a physical retailer like Bealls.

**Why sixth:** Bealls-specific but generalizes to every brick-and-mortar BC merchant. Differentiation against pure-DTC competitors.

**Estimated:** ~2 weeks human, ~4 days agent.

### Total V1: ~13 weeks human, ~3.5 weeks agent

After V1, the roadmap returns to the engine layer's deeper personalization (negative signal weight asymmetry, device-aware format hints, continuous embedding investments) and admin layer's experimentation surface.

---

## 7. Open strategic questions

These need product leadership input before the work above starts. Ranked by load-bearing-ness.

1. **Is the four-pillar bet correct?** Specifically: does commerce.com see a market gap between insertion-rule personalization (DY/Monetate) and pure-discovery search/recs (Algolia/Constructor) that Aisles' generative composition fills? If leadership reads the gap as "merchants are happy with insertion personalization," Pillar 1 collapses and Aisles needs to repivot.
2. **Is BC-native distribution worth the architectural commitment?** BC integration depth (channels, native auth, marketplace app) is structurally expensive. If the answer is "BC distribution is incidental, not central," Aisles becomes a multi-platform headless framework — a different product.
3. **Is explainability load-bearing or nice-to-have?** If the merchant audience values lift over explainability (which incumbents bet on), Pillar 4 collapses to "feature, not differentiation."
4. **Is custom checkout in or out?** Foundation research says hand off to BC Optimized Checkout. But that means we never personalize the checkout experience. If product leadership disagrees and wants checkout personalization, we add it back to V1 scope and adjust phases.
5. **What's the V1 commercial shape?** Single SKU, tiered, modular per layer? The three-layer architecture supports any of these — but the pricing decision affects the admin's role hierarchy and the engagement plan with Bealls.

These questions are the gating items for converting this strategy into PRD/BRD (Task #44) and resuming engine implementation work (Task #45).

---

## 8. Related documentation

- [`NORTH-STAR.md`](NORTH-STAR.md) — what Aisles is
- [`risks.md`](risks.md) — load-bearing bets and fallback paths
- [`engagements/bealls.md`](engagements/bealls.md) — Bealls engagement plan
- [`../architecture/engine/composition-taxonomy.md`](../architecture/engine/composition-taxonomy.md) — block × surface × latitude rules
- [`../research/engine/competitive-survey.md`](../research/engine/competitive-survey.md) — full engine-layer competitive analysis
- [`../research/foundation/competitive-survey.md`](../research/foundation/competitive-survey.md) — full foundation-layer reference platform analysis
- [`../research/admin/competitive-survey.md`](../research/admin/competitive-survey.md) — full admin-layer competitive analysis

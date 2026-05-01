# Aisles — Strategy

**Version**: 0.4.0
**Last Updated**: 2026-04-30
**Audience**: commerce.com internal teams — product, engineering, customer success
**Companion to**: [`NORTH-STAR.md`](NORTH-STAR.md), [`risks.md`](risks.md)

NORTH-STAR defines what Aisles is. STRATEGY defines **what we're testing, what each team learns, and what's explicitly out of scope.** Stage 1 cross-industry research (which informs every section here) lives in [`docs/research/{engine,foundation,admin}/`](../research/) — this doc is the synthesis.

> **Reframe note (v0.4.0):** earlier drafts of this doc framed Aisles as a commercial product with strategic bets, defensive moats, and competitive wedges. v0.4.0 reframes it as an **experiment** — a working artifact our internal teams react to. The audience changed (internal teams, not leadership-evaluating-a-product), and so the trade-offs are framed as **hypotheses to test + lessons surfaced**, not bets to commit to. If the experiment succeeds, the question "should we productize any of this" becomes a real, evidence-backed conversation later.

---

## 1. The experimental shape

**Aisles is a working possibility prototype. It is in market with one example merchant (Bealls). Our teams use it to find out what's true about three things at once:**

1. Whether **schema-typed generative composition** of ecomm surfaces is shippable in production with formal correctness guarantees.
2. Whether **bundling** AI engine + ecomm foundation + merchant control plane (vs. assembling from incumbents) materially changes what merchants can do.
3. Whether **BC-native packaging** (vs. tag-and-SI integration) reaches BC merchants in ways our current sales motion can't.

These are hypotheses, not bets. The experiment exists to test them. Success is "our teams now know which are true and act on the answers" — not "we shipped an MVP and signed merchants."

---

## 2. What each team learns from the artifact

The artifact is the same. Each team extracts something different from it.

### 2.1 Product teams

**Question:** What capabilities does this surface that we should adopt into our actual roadmap?

**What to look at in the artifact:**

- The **block catalog** ([`composition-taxonomy.md`](../architecture/engine/composition-taxonomy.md)) — what specific merchandising primitives (BOPIS strip, brand spotlight, price-rail, trend-shop) does Bealls show that today's BC merchants assemble from disconnected widgets?
- The **surface × block matrix** — which surfaces are mandatory-block-heavy (PDP, cart, checkout) vs. AI-composed-heavy (home, PLP) — and is this the latitude split that matters for our merchants?
- The **mode flag** (storefront vs. content-only) — Home Centric exercises a real discipline split. Is this a feature category we've under-served?
- The **persona model** — gatherer/hunter/researcher/gifter. Is the specific model right? Is having any persona model right? Or do merchants want to author their own personas?

**What product teams should bring back:** a list of merchandising primitives + workflow patterns the artifact demonstrates that aren't in our current roadmap, with merchant-value justifications attached. Not commitments — observations.

### 2.2 Engineering teams

**Question:** What architectural patterns and tech bets are validated or invalidated? What's worth copying?

**What to look at in the artifact:**

- The **V invariant** (`∀I, ∀P, f(I, P) → S ∈ V`) and its enforcement cascade (Zod schema → Anthropic structured output → fallback to Sonnet → fallback to static layout). Is this reliable enough to ship for production AI composition?
- The **layout cache** by `(brandId, surface, persona, picks-hash)` — is the cache key shape right? What's the steady-state hit rate? When does it miss?
- The **signal pipeline** (server-side request signals + client-side behavioral emitter + 5s flush) — is this the right shape for production-grade behavior tracking, or does it conflict with our analytics infrastructure?
- The **Vercel AI Gateway** routing (Haiku 4.5 primary, Sonnet 4.6 fallback) — does the model fallback cascade actually pay off in observed quality/cost numbers?
- The **multi-brand configuration** — three Vercel projects, one codebase, BRAND_ID env var. Is this the right multi-tenancy shape, or is per-merchant database isolation safer?
- The **Atelier-shape doc structure + ADR practice** — is this worth adopting in production repos for capability we ship?

**What engineering teams should bring back:** a list of architectural patterns and tech choices the artifact validates (or invalidates) for our production stack — including ones we should copy into existing services regardless of whether Aisles itself ships.

### 2.3 Customer success teams

**Question:** What new merchant conversations does this enable? What objections does it expose?

**What to look at in the artifact:**

- The **Bealls demo flow** — when a CS team member walks a merchant through Bealls, what reactions surface? Which moments produce "we want this"? Which produce "we'd never let an AI do that"?
- The **Decisions Inspector / Observe dashboard** (when shipped) — does the explainability surface answer the merchant questions our current AI features can't answer (why did the AI do this, what changed, who can override)?
- The **engagement scope** ([`engagements/bealls.md`](engagements/bealls.md)) — Bealls is a real BC merchant with real properties (BOPIS, multi-brand, content-only HC, off-price pricing). Which Bealls properties are common to our other merchants, and which are Bealls-specific?
- The **failure modes** — when the AI proposes something a merchant wouldn't approve, how do they describe what went wrong? What's the language merchants use that our current docs don't address?

**What customer success teams should bring back:** a catalog of merchant questions the artifact answers (or fails to answer), with conversation transcripts and the language merchants used. This becomes the input for objection-handling, FAQ, and pre-sales materials regardless of whether Aisles is ever productized.

---

## 3. The three hypotheses + how we test them

### 3.1 Hypothesis 1 — Schema-typed generative composition is production-viable

**The claim:** an AI agent constrained by a finite typed schema can compose ecomm surfaces with sufficient correctness, latency, and explainability to ship in production.

**How the artifact tests it:**
- Run Haiku 4.5 → Sonnet 4.6 fallback cascade across all three Bealls brands, all surfaces, all personas. Measure schema-validation success rate (target: >99% first-try, 100% with fallback).
- Measure end-to-end p95 latency: cold-start generation, cache-hit response, streaming first-paint.
- Run the Decisions Inspector against a sample of compositions. Can a non-engineer explain why each composition was produced?

**What we'd learn if it fails:**
- *Engineering:* schema-typed generative AI is not yet ready for prod; fall back to insertion-rule personalization patterns Adobe/DY/Monetate use.
- *Product:* "AI-generated layouts" is a future-state capability, not a near-term one. Roadmap-relevant features: AI-assisted variant authoring (Adobe AI Assistant pattern) instead.
- *Customer success:* re-position any AI conversations toward "AI helps your team author" not "AI authors for your shoppers."

**What we'd learn if it succeeds:**
- *Engineering:* the V invariant pattern is worth adopting in any service that emits structured output (CMS recommendations, search facets, A/B variants). Adopt the schema-validation cascade as a production pattern.
- *Product:* the "compose" verb belongs in our product vocabulary. Identify which existing product surfaces would benefit from compose-rather-than-configure UX.
- *Customer success:* a new pre-sales narrative becomes available — "AI that always renders, with audit trail."

### 3.2 Hypothesis 2 — Bundling engine + foundation + admin materially changes merchant outcomes

**The claim:** merchants who get a complete experience (storefront + AI engine + merchant controls) in one package can do things they cannot do when they assemble these from separate vendors.

**How the artifact tests it:**
- Compare merchant time-to-value: what does it take Bealls to ship a personalized homepage on Aisles vs. what it would take to ship the same on BC + Dynamic Yield + Contentful?
- Surface the cross-layer contracts (rule authored in admin → engine respects it on PLP → foundation honors in cart) and observe whether they unlock workflows that point-tool stacks can't.
- Walk customer success through merchant scenarios that require admin → engine → foundation coordination. Note the friction in current point-tool flows.

**What we'd learn if it fails:**
- *Product:* merchants don't perceive bundling as differentiated; they buy best-of-breed and integrate. Roadmap-relevant: integration depth investments rather than bundle investments.
- *Engineering:* don't optimize architecture for bundle coherence; optimize for clean interface contracts so we can be one of the point tools merchants assemble.
- *Customer success:* "complete platform" is not a winning narrative; switch to "best-in-class for [layer]."

**What we'd learn if it succeeds:**
- *Product:* identify the cross-layer workflows that the bundle unlocks; prioritize them in the roadmap.
- *Engineering:* the cross-layer contracts (Engine ↔ Foundation, Admin ↔ Engine) become design patterns to enforce in any future product.
- *Customer success:* "one platform that does the merchandising, the experience, and the merchant control plane" becomes a real story we can tell.

### 3.3 Hypothesis 3 — BC-native packaging reaches merchants our current motion can't

**The claim:** a BigCommerce-native AI/composition product distributed via the BC marketplace reaches merchants that tag-and-SI personalization platforms (DY, Monetate, Salesforce, Adobe) cannot.

**How the artifact tests it:**
- Walk Bealls through Aisles' BC-marketplace-native install (channels, native auth, native catalog, native marketplace listing). Measure friction vs. their current personalization tooling.
- Survey customer success conversations with prospective merchants — do they ask for "BC-native" specifically, or is it incidental?
- Inspect the engineering investments BC-native required (channels, GraphQL Storefront, marketplace OAuth, embedded admin). What was learned about BC-native architecture that would generalize to other commerce.com products?

**What we'd learn if it fails:**
- *Product:* BC-native is incidental, not central. Don't over-invest in marketplace distribution for new capabilities.
- *Engineering:* the BC-native investments (channels, marketplace OAuth) are scoped to the experiment, not generalized patterns.
- *Customer success:* don't lead BC merchant conversations with "we're BC-native" — lead with capability.

**What we'd learn if it succeeds:**
- *Product:* BC-native distribution is a viable wedge for new products. Prioritize marketplace presence for capabilities targeting BC merchants.
- *Engineering:* BC-native architecture (channels, GraphQL Storefront, marketplace app pattern) becomes a reference architecture. Document the patterns.
- *Customer success:* the "one-click install vs. integration project" differentiator is a real lead-gen narrative.

---

## 4. What the landscape teaches our teams

Detailed comparisons of all twelve platforms surveyed are in [`docs/research/engine/competitive-survey.md`](../research/engine/competitive-survey.md). The lessons-our-teams-should-internalize summary:

### 4.1 The category map (and what each cluster reveals)

| Cluster | Players | What they reveal |
|---|---|---|
| **AI insertion personalization** | Dynamic Yield, Monetate, Salesforce Personalization, Adobe Target, Optimizely | Mature category with paying customers. Insertion at named zones is well-understood and well-tooled. The "ceiling" of this cluster is what Aisles must clear to be interesting — but it's a high ceiling. |
| **AI search + recs** | Algolia, Bloomreach, Coveo, Klevu, Constructor.io | Recommendation infrastructure is increasingly commoditized; differentiation moves to merchandising controls and explainability. **Constructor's outcome-trained ranking** sets a high bar for "what AI can do without typed composition." |
| **Generative variant tools** | Builder.io AI, Shopify Magic, Klaviyo K:AI, Optimizely Opal | The **deliberate stance** of "AI helps humans author, doesn't author for them" is a strategic signal about merchant trust. Our teams should investigate whether this stance reflects actual merchant preference or vendor caution. |
| **Headless commerce frameworks** | commercetools Frontend, Saleor, Vue Storefront, Hydrogen | Reference implementations of "what an ecommerce app foundation looks like." Stage 1 foundation research extracted ~15 universal sections per surface from these. **Section/region authoring is universal table-stakes** across all of them. |
| **Headless CMS + page builders** | Contentful, Sanity, Storyblok, Builder.io | Typed content models, preview/publish workflows, locales, role-based access. **Their role taxonomies (Admin/Developer/Editor/Author/Analyst) are battle-tested** and worth copying for any merchant-facing tool we build. |

### 4.2 What our teams should sit with

**For engineering:** *no incumbent combines schema-typed composition output with AI generation.* Constructor types their data; Algolia types their data; Bloomreach types their CMS; Shopify types their admin. None type their composition output. This is structurally surprising. Either it's a hard problem (the V invariant approach is non-trivial; competitors haven't figured it out) or it's a problem nobody wanted to solve (merchants don't want generative composition). The artifact tests which.

**For product:** *Adobe AI Assistant, Klaviyo K:AI, Optimizely Opal all chose to make humans faster at authoring variants rather than generate variants.* This is a coordinated strategic stance from incumbents who employ thousands of product designers. Take it seriously. The artifact lets CS test whether merchants actually share this preference or whether incumbents are projecting caution.

**For customer success:** *the explainability gap is real.* Adobe Target Auto-Personalization, Dynamic Yield Predictive Targeting, and Monetate bandits are black boxes. Sanity's Content Source Maps and Constructor's MIA are the only competitors flirting with explainability — both thin. The Decisions Inspector ("what did the AI just do, and why?") is the artifact's most defensible feature for merchant conversations. Test whether merchants actually want the answer to "why."

### 4.3 The biggest landscape signal to monitor

**Bloomreach.** Loomi (AI brand) + Clarity (agentic chat) + Discovery (search/recs) + Content (CMS) + Engagement (CDP/email) + Elite BigCommerce partnership. If Bloomreach Clarity extends from chat to page composition, the experimental space Aisles occupies compresses materially. Engineering teams should monitor Bloomreach release notes; customer success should track Bloomreach mentions in merchant conversations.

---

## 5. What's explicitly out of scope (experiment scope, not product scope)

The artifact intentionally does not test these. Each of these is a real product category we could chase but explicitly aren't, because doing so would dilute the three hypotheses above.

| Out of scope | Why we don't test it | What the artifact uses instead |
|---|---|---|
| **Custom checkout flow** | Foundation research consensus: Hydrogen redirects to Shopify Checkout; Cornerstone uses BC Optimized One-Page. Building custom checkout is a separate program with payment-method risk and PCI scope expansion. The hypotheses don't require checkout latitude. | Hand off to BC Optimized One-Page Checkout. Engine personalizes upsells, copy, and trust assurances on the way in. |
| **Headless CMS for arbitrary content** | Contentful, Sanity, Storyblok own this category. Aisles' content authoring is bounded by the engine's component vocabulary — not free-form. | Admin authors blocks the engine knows how to compose with; arbitrary CMS work goes elsewhere. |
| **Email / SMS / push CDP** | Klaviyo, Bloomreach Engagement, Salesforce Marketing Cloud own this. Email touch is downstream of the storefront experience. | Integration only — surface signals to those tools, don't replace them. |
| **Subscription commerce** | Recharge, Subbly, BC native subscriptions own this. Subscription UX is its own surface taxonomy. | Out of scope for the experiment. |
| **B2B catalogs / negotiated pricing** | commercetools, Spryker, BC B2B own this. B2B is its own composition latitude problem. | Out of scope. |
| **Marketplace / multi-seller flows** | Mirakl owns this; BC has its own multi-vendor work. | Out of scope. |
| **Real-time personalization < 100ms** | Aisles targets seconds-fresh, not millisecond-fresh. The cache-and-stream architecture means most visitors see a sub-100ms cached layout, but the first generation per (brand, surface, persona, picks-hash) is 5–10s. | Acceptable trade-off for the experiment; revisit if findings warrant. |
| **Replacing payment processor** | BC handles via integrations. | Use BC's payment integrations. |
| **Replacing analytics platform** | Mixpanel, Amplitude, Segment own this. The Observe dashboard is operational telemetry for the engine, not behavioral analytics for merchant marketing teams. | Surface signals + engine telemetry; don't try to be GA. |
| **Custom ad targeting / paid media** | Google Ads, Meta Ads own this. The growth-lead persona uses Aisles to interpret paid traffic, not to buy it. | Out of scope. |

---

## 6. Experimental risks (not strategic risks)

Detailed in [`risks.md`](risks.md). The five risks that matter for the experiment producing useful learnings:

| Risk | Description | What it would mean |
|---|---|---|
| **RISK-01: Composition latency** | First-gen 5–10s wait isn't acceptable; cache hit rate degrades performance | Hypothesis 1 inconclusive — the V-invariant approach can't ship at acceptable latency without further engineering, blocking real testing |
| **RISK-02: Schema lock-in** | 6 surface schemas cover 90% of merchants, but the long tail is uncovered | The experiment over-constrains; we don't learn what merchants would actually want |
| **RISK-04: Authoring complexity** | Merchandisers can't operate the admin without engineer support | Hypothesis 2 (bundling = better merchant outcomes) fails — bundling without merchant-operable controls is just lock-in |
| **RISK-05: Bloomreach extends Clarity to surface composition** | Bloomreach ships generative composition before our experiment produces clear findings | Experiment becomes obsolete; learnings get rolled into "Bloomreach already does this" rather than "this is novel possibility" |
| **RISK-06: Merchants reject "AI built something we didn't approve"** | Generative composition is structurally rejected by merchants regardless of explainability | Hypothesis 1 invalid for the merchant audience; reframe toward variant-authoring AI |

Two **new experiment-specific risks** added with the v0.4 reframe:

| Risk | Description | What it would mean |
|---|---|---|
| **RISK-07: Vanity demo** | The artifact gets shown to teams who say "neat" but extract no actionable lessons | Experiment produces no learning. Mitigation: structured walk-throughs per audience (§2 of this doc), with artifacts (capability list / architecture review / merchant transcripts) per team. |
| **RISK-08: Bealls overfitting** | All learnings are Bealls-specific; can't be generalized | Hypotheses look validated but don't extend. Mitigation: the second engagement (under separate research) tests whether Bealls findings generalize. |

---

## 7. Sequencing — what gets built next, why

The implementation sequence is in [`../architecture/engine/composition-taxonomy.md`](../architecture/engine/composition-taxonomy.md) §8. Reframed under v0.4 as **a sequence of capability demonstrations**, not a V1 build plan:

### Phase 1: Close the missing foundation surfaces

Per foundation research, the artifact is missing 5 critical surfaces (account dashboard, real checkout, search results with facets, branded 404/empty states, section authoring model). Without these, the artifact can't claim "complete ecomm site," and Hypothesis 2 (bundling) can't be tested fairly.

**What this demonstrates:** completeness of the foundation layer; cross-layer contracts between admin (content authoring) and foundation (renders).

### Phase 2: Define the section authoring model

Per foundation research, **section/region authoring is universally table-stakes**. Every reference theme (Dawn, Cornerstone, commercetools Frontend, Saleor) ships named, reorderable insertion zones. The artifact must define this contract before AI composition extends to PDP/Cart/Checkout.

**What this demonstrates:** the engine ↔ foundation contract; the production-viable shape of "named insertion zones the AI composes into."

### Phase 3: Schema split + PDP/Cart/Checkout composition

The single `LayoutSchema` becomes 6 surface-typed schemas. PDP gets 9 mandatory scaffold blocks plus named insertion zones. Cart/Checkout get fixed scaffolds + named upsell/personalization zones.

**What this demonstrates:** the composition latitude principle in production (wide on home, narrow on PDP, fixed on cart/checkout). Tests Hypothesis 1 at scale.

### Phase 4: Decisions Inspector in admin

Per admin research, **the explainability gap is the most defensible admin capability**. Build the Decisions Inspector as the admin's daily-driver before adding more rule types.

**What this demonstrates:** Hypothesis 1's explainability claim concretely; the merchant-trust mechanism for generative composition.

### Phase 5: Workspaces + RBAC in admin

The artifact must include workspace + role-based access control. Bealls + an agency model demands it; retrofitting permissions later costs roughly 10x.

**What this demonstrates:** merchant-grade controls; the admin's readiness for non-trivial merchant org structures.

### Phase 6: Locator + BOPIS depth (Bealls-specific value)

Per foundation research, **locator is the rare universal gap** (only Hyvä ships default). Combined with PDP pickup-availability, this is the most defensible foundation-level investment for a physical retailer.

**What this demonstrates:** the artifact's relevance to physical retailers (a non-trivial fraction of BC merchants); a capability the entire reference category under-serves.

### Total demonstration sequence: ~13 weeks human / ~3.5 weeks agent

After this sequence, the experiment has surfaced the answers to the three hypotheses (or surfaced clear "we couldn't tell" outcomes). At that point, productization conversations with leadership become evidence-backed.

---

## 8. Open questions — by audience

Earlier drafts aggregated these as "questions for product leadership." Reframed for v0.4 by audience.

### For product teams

1. **Block catalog completeness:** the composition taxonomy lists ~80 P0+P1 blocks. Are there block categories the artifact misses that you observe in merchant conversations? (e.g., subscription blocks, B2B blocks, marketplace blocks)
2. **Persona model fit:** the 4-persona model (gatherer/hunter/researcher/gifter) is opinionated. Do merchants want this specific model, a different one, or to author their own? Test in CS conversations.
3. **AI authoring vs. AI assistance:** Adobe/Klaviyo/Optimizely chose AI assistance over AI authoring. Is this the right stance for our merchants too? The artifact's generative approach lets you observe merchant reactions empirically.

### For engineering teams

1. **V invariant adoption:** is the schema-typed structured-output pattern worth adopting in production codebases that emit structured AI output (search facets, recommendations, A/B variants), independent of whether Aisles itself ships?
2. **Multi-tenancy shape:** the `BRAND_ID` env var + per-brand Vercel project pattern is one possible multi-tenancy shape. Is this the right pattern for our production work, or is database-level isolation safer?
3. **AI Gateway abstraction:** Vercel AI Gateway provides routing and cost tagging. Is this abstraction worth adopting more broadly, or should we use direct Anthropic/OpenAI clients?

### For customer success teams

1. **Merchant explainability demand:** when merchants see the Decisions Inspector, do they engage with it or ignore it? The answer informs the value of explainability investments across the product line.
2. **Bealls generalizability:** which of Bealls' properties (off-price, family-of-brands, BOPIS, content-mode HC) generalize to your other merchants, and which are Bealls-specific?
3. **Productization sentiment:** when merchants see Aisles, do they ask "can we buy this?" or "can we hire commerce.com to build this for us?" or "we'd love this if it worked with our existing tools"? Each answer points to a different productization shape.

These questions have no leadership pre-commit attached. They are inputs for the next round of conversations.

---

## 9. Related documentation

- [`NORTH-STAR.md`](NORTH-STAR.md) — what Aisles is
- [`risks.md`](risks.md) — experimental risks and watch-list
- [`engagements/bealls.md`](engagements/bealls.md) — Bealls engagement plan (the artifact)
- [`../architecture/engine/composition-taxonomy.md`](../architecture/engine/composition-taxonomy.md) — block × surface × latitude rules
- [`../research/engine/competitive-survey.md`](../research/engine/competitive-survey.md) — full engine-layer competitive analysis
- [`../research/foundation/competitive-survey.md`](../research/foundation/competitive-survey.md) — full foundation-layer reference platform analysis
- [`../research/admin/competitive-survey.md`](../research/admin/competitive-survey.md) — full admin-layer competitive analysis

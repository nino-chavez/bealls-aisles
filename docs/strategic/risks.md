# Strategic Risks & Fallback Paths

**Version**: 0.3.0
**Last Updated**: 2026-04-30

Per the Atelier convention, risks live separate from spec. Each entry names a load-bearing strategic bet, the failure mode, the trigger signal, and the fallback path.

## Format

```
RISK-NN: <title>
Bet: <what we're betting on>
Failure mode: <what happens if the bet is wrong>
Trigger signal: <how we detect the bet is failing>
Fallback path: <what we do instead, and what it costs>
Owner: <who watches this>
```

## Active risks

### RISK-01: AI composition latency

- **Bet:** 5–10s first-generation latency is acceptable for AI-personalized homepage if the cache hit rate stays above 80%.
- **Failure mode:** shoppers bounce on first generation; cold-start cache misses degrade conversion.
- **Trigger signal:** observed bounce rate during the LayoutBuildingState window > 30%, OR cache hit rate < 70% in steady state.
- **Fallback path:** ship streaming partials (already shipped); add cold-start prerender via Vercel ISR for the top N (brand, persona) cells; degrade to static persona-templated layouts when AI Gateway is slow. Cost: ~3 days agent for prerender; the static template fallback is a 1-day adjustment to `+page.svelte` static fallback paths.
- **Owner:** engine layer

### RISK-02: Schema lock-in

- **Bet:** 6 surface-typed schemas (home, PLP, PDP, search, cart, checkout, account, empty/locator) cover 90%+ of ecomm sites.
- **Failure mode:** merchants need a 7th surface (subscription portal, B2B catalog, multi-vendor) and the schema model doesn't extend.
- **Trigger signal:** 2+ merchant deals lost on "we need surface X."
- **Fallback path:** extension hook in admin to add surface schemas without engine change — would require a typed-schema authoring UI in admin (~3 weeks human work). Avoid by deciding scope in Task #44 PRD.
- **Owner:** engine + admin layers

### RISK-03: Demo→product gap

- **Bet:** Bealls demo features translate to commerce.com merchant pitch.
- **Failure mode:** features that demo well to leadership don't sell to merchants. Common pattern: AI personalization demos beautifully but merchants want control, predictability, and clarity over magic.
- **Trigger signal:** post-demo merchant conversations don't progress to scoping calls; merchants ask "can we turn the AI off?" within first 10 minutes of every meeting.
- **Fallback path:** pivot to 2–3 additional reference merchant engagements in different verticals before V1 commit. Reduces Bealls-shaped overfitting. Cost: ~2 weeks of reference-merchant research per additional engagement. Research finished 2026-04-30; conversations with leadership about additional merchants are open.
- **Owner:** product leadership

### RISK-04: Merchant authoring complexity

- **Bet:** merchandisers can author rules and operate the admin without engineering support.
- **Failure mode:** rule UI is too complex, merchants don't use it, the admin becomes shelfware, the engine personalization quality degrades because merchants stop tuning it.
- **Trigger signal:** post-onboarding admin DAU < 30% of merchant team; merchants requesting "professional services" tier instead of self-serve.
- **Fallback path:** managed services tier with templates per merchant; reframe admin daily-driver from "rules" to "decisions" (Decisions Inspector). The Decisions Inspector reduces the cognitive load on merchants by letting them react to AI behavior rather than predict it. Cost: ~3 weeks human work for the Inspector — already in the V1 roadmap (Phase 4).
- **Owner:** admin layer

### RISK-05: Bloomreach extends Clarity to surface composition (NEW, surfaced 2026-04-30)

- **Bet:** Aisles ships the Decisions Inspector and typed-schema audit trail before Bloomreach extends Clarity (their agentic chat) from chat turns to page composition.
- **Failure mode:** Bloomreach's Loomi + Clarity + Discovery + Content + Engagement stack plus their Elite BigCommerce partnership compresses Aisles' wedge to "BC-native and cheaper" within 12 months.
- **Trigger signal:** Bloomreach announces Clarity supporting page composition or "AI page authoring"; Bloomreach Discovery + Engagement bundling SKU launches with composition; BC marketplace shows Bloomreach moving from search-only to composition-capable.
- **Fallback path:** double down on differentiation, not capability count. Two structural advantages remain: (1) BC-native composition (Bloomreach's Discovery is BC-native, but their composition layer would be Discovery + a new product, not native), (2) merchant explainability (Bloomreach's Engagement is generic CDP UX with no Decisions Inspector equivalent). Lead pitches with the Inspector and the "Aisles tells you why" line. Cost: ~0 if shipped on schedule; ~6 months of repositioning if Bloomreach launches first.
- **Owner:** product leadership + engine + admin

### RISK-06: Merchants reject "AI built something we didn't approve" (NEW, surfaced 2026-04-30)

- **Bet:** Decisions Inspector + preview-before-publish + rule-bound generation overcomes merchant resistance to generative composition.
- **Failure mode:** merchants view generative composition as control loss. The pattern is observable across Adobe AI Assistant, Klaviyo K:AI, and Optimizely Opal — all chose to make humans faster at authoring variants rather than generate variants. This may reflect a structural merchant preference, not a capability gap.
- **Trigger signal:** discovery interviews show 60%+ of mid-market BC merchants want "AI helps me author" over "AI authors and I review"; demo audiences ask "can we approve every layout before it goes live" within first 5 minutes; sales cycles stall on "we need to see the layout before it ships."
- **Fallback path:** if resistance is structural, Aisles' positioning shifts from "generate" to "compose with strict merchant approval." A narrower wedge but still defensible — the V invariant + typed schemas are still differentiated against insertion-rule platforms. The composition step becomes "AI proposes, merchant approves, publishes" rather than "AI composes live." Cost: workflow rebuild in admin (~3 weeks), no engine architecture change since the schema-typed output already supports preview/approve flows.
- **Owner:** product leadership + admin

---

## Resolved risks

> _empty — resolved risks move here with resolution date and outcome._

---

## Watch-list (not yet load-bearing)

These are not strategic risks today but may become so. Owners watch for trigger signals.

- **WATCH-01: Embedded LLM costs.** Today the engine uses Anthropic Haiku 4.5 via Vercel AI Gateway. Cost is ~$0.0015 per layout generation. At 1M monthly visitors per merchant, ~80% cache hit rate, that's ~$300/month in LLM cost — acceptable. If model costs spike or merchants scale to 10M+ MAU, the unit economics need re-examination. **Owner:** engine layer.
- **WATCH-02: BC platform lock-in.** Aisles' BC-native architecture is a moat in 2026. If BC pricing/policy changes (e.g., gated marketplace economics, breaking API changes), the moat becomes a trap. **Owner:** product leadership.
- **WATCH-03: Browser-side privacy regulations.** Engine-layer signal collection assumes cookie/session continuity. Aggressive third-party cookie deprecation already affects retargeting; if first-party cookie restrictions expand, the persona inference cold-start degrades. **Owner:** engine layer.
- **WATCH-04: Anthropic / OpenAI / Vercel AI Gateway concentration.** All three are points of vendor concentration. Multi-model routing at the AI Gateway layer mitigates short-term risk; long-term, the architecture must remain model-agnostic. **Owner:** engine layer.

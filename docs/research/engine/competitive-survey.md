# Engine Layer — Competitive Survey

**Stage:** BigBlueprint Stage 1 (cross-industry research)
**Audience:** commerce.com product leadership
**Scope:** AI composition / personalization engines competing with the Aisles engine layer
**Date:** 2026-04

---

## 1. Executive summary

The personalization-engine category is large, mature, and almost entirely organized around **ranking and routing pre-authored content** rather than generating it. The dominant players (Dynamic Yield, Monetate, Bloomreach, Salesforce Personalization, Adobe Target, Optimizely) ship a similar shape of product: a campaign/experiment console where merchants author segments and variants, then let the platform pick which variant to show. Search-led players (Algolia, Coveo, Klevu, Constructor) sit underneath that layer, ranking the catalog itself but rarely composing the surrounding page. Two new vectors have opened in the last 12 months: (a) **conversational/agentic** UIs bolted on top of search (Coveo Conversational Product Discovery, Bloomreach Clarity, Shopify Sidekick), and (b) **generative content fragments** — AI-written copy, hero blocks, descriptions — slotted into otherwise hand-authored templates (Adobe AI Assistant, Klaviyo K:AI, Shopify Magic).

The three axes that actually distinguish players are: **(1) composition latitude** — does the engine generate the surface, insert blocks at named anchors, just rank items, or just A/B between hand-built variants; **(2) primary daily-driver** — is the merchant living in a rule/segment builder, an experiment console, a search merchandising tool, or a journey orchestrator; and **(3) typed schema contract** — does the engine emit a validated structured layout, or does it inject HTML/text into a slot and trust the storefront to render it. Almost nobody scores high on (1) and (3) simultaneously; the incumbents are deliberately conservative on (1) because their merchants need predictability, and the AI-native challengers are conservative on (3) because schema-typed generation is harder than free-form text completion.

---

## 2. Comparison matrix

| Platform | Composition latitude | Schema-typed output | Persona / audience model | Multi-brand / multi-region | Pricing model | Primary daily-driver | BC integration |
|---|---|---|---|---|---|---|---|
| Dynamic Yield (Mastercard) | **Insert** at named slots; A/B between authored variants; recs ranking | No (HTML/JSON variant payloads) | Real-time + batch segments; Mastercard Element predictive models | First-class (multi-property) | Annual license, ~$35k+ floor; deal-based | Experience OS (campaign + variant builder) | Native partner app |
| Monetate (Kibo, now standalone) | **Insert** + A/B; ML-decisioned variant routing (Dynamic Tests) | No | Behavioral segments, ML decisioning | Yes | Annual license, deal-based | Experience console | Plug (no native BC app, integrator-led) |
| Bloomreach Discovery + Engagement + Content + Clarity | **Rank** (Discovery), **insert** (Engagement weblayers), **conversational generate** (Clarity) | Partial (Content is structured CMS); Discovery returns ranked lists; Clarity emits chat turns | Loomi AI, real-time + historical, segment + 1:1 | First-class enterprise | Annual license, deal-based | Discovery merchandising console + Engagement journey builder | Elite Technology Partner; native BC app |
| Salesforce Personalization (Marketing Cloud Personalization, ex-Interaction Studio / Evergage) | **Insert** + recs ranking; experience targeting | No | Einstein-driven real-time + Data Cloud segments | Yes (Marketing Cloud tenant model) | Marketing Cloud add-on; deal-based | Personalization studio inside Marketing Cloud | Plug (via Data Cloud / SFCC / connectors) |
| Adobe Target | **A/B** + **insert** (Experience Targeting); Recommendations ranking | No (offers are HTML/JSON snippets) | AEP-backed segments, Auto-Target ML, Auto-Personalization | Yes (workspaces) | Adobe Experience Cloud add-on; deal-based | Target activity console; Journey Optimizer Experimentation Accelerator | Plug (via AEP / connector); no native BC app |
| Algolia Recommend | **Rank** (related, FBT, trending, looking-similar) | API returns typed result lists, not page layouts | Personalization add-on (events-driven re-ranking) | Yes (multi-index) | Per-request ($0.60 / 1k after 10k free); volume tiers | Algolia dashboard (index + merchandising) | Native BigCommerce connector + native Recommend support |
| Coveo AI-Relevance | **Rank** + **conversational generate** (Conversational Product Discovery, Mar 2026) | API returns ranked lists; conversational layer emits chat turns and product references | ML in-session + historical; agentic orchestration | Yes (multi-source) | Annual license, deal-based | Coveo admin (relevance tuning, query pipelines) | Plug (Push API / SDK; no documented native BC connector) |
| Klevu (Athos Commerce) | **Rank** + merchandising; **insert** recs | Partial (typed result/recs payloads) | Clickstream + collaborative filtering; segments | Yes | SaaS tiered; per-traffic | Merchandising console | Native BigCommerce app |
| Constructor.io | **Rank** + browse + recs + collections + quizzes; outcome-trained | Typed payloads for search/browse/recs | In-session intent + historical, unified across surfaces | Yes | Annual license, often outcome/revenue-share | Constructor dashboard (merchandising + quizzes) | Native BigCommerce connector (Constructor Connect) |
| Optimizely Web Experimentation | **A/B** between hand-authored variants; rule-based personalization | No (variants are DOM mutations / JS) | Audience builder, third-party data | Yes | Annual license; experiment-volume tiered | Experiment editor + visual variation builder | Plug (snippet) |
| Klaviyo (predictive personalization) | **Insert** in email/SMS; rank in product blocks; segment generation | No | Predictive CLV, churn risk, next-order date; AI-generated segments | Yes (account-level) | Per-active-profile (MAU-style) | Klaviyo console (campaigns, flows, segments) | Native BigCommerce app |
| Shopify Magic / Sidekick | **Generate** copy, **generate** apps, **predict** intent (Shopify-only) | Tied to Shopify Polaris/admin schema | Built-in Shopify CDP + behavioral | Single-tenant per shop | Bundled with Shopify | Shopify admin | N/A (Shopify-only; not a BC option) |

Legend for composition latitude:
- **Generate** = engine produces UI structure, not just text/items
- **Insert** = engine drops a block (authored or templated) into a named slot
- **Rank** = engine orders items in a list/grid the storefront already renders
- **A/B** = engine picks one of N hand-built variants

---

## 3. Per-platform deep dives

### 3.1 Dynamic Yield (Mastercard)

**Positioning.** "ExperienceOS" — the canonical personalization-and-experimentation console for mid-market and enterprise retail, QSR, and travel. Acquired by Mastercard in 2022; since then the product has leaned into Mastercard's data assets (SpendingPulse, propensity models, loyalty/MTR/MRS) under the "Element" brand.

**What merchants get.** A full campaign console: audience builder, variant editor (HTML/JSON variations injected via SDK or tag), recommendations widgets, A/B and bandit experiments, and a reporting layer. The daily driver is "build a campaign, define segments, author variants, ship."

**Latitude.** Insert + A/B + rank. Variants are authored by humans (or pulled from a CMS/PIM); DY decides which variant fires for which user. Recommendations are ranked from the catalog by ML models. There is no first-party generation of layouts — the engine routes between things you've already built.

**Seam.** DY does not own the storefront's component model. It expects the storefront to expose named slots/selectors and accept variant payloads. It integrates with BigCommerce via a partner app but is not BigCommerce-native; merchants typically also pay for a CDP/CDW upstream.

Sources:
- https://www.dynamicyield.com/
- https://www.dynamicyield.com/partner/bigcommerce/
- https://www.dynamicyield.com/blog/mastercard-personalization-suite-element/
- https://www.personizely.net/blog/dynamic-yield-pricing

### 3.2 Monetate (formerly Kibo Personalization)

**Positioning.** Personalization plus experimentation for retail; the ex-Certona recommendations IP merged with Monetate's testing engine, then spun back out from Kibo in late 2022 under the standalone Monetate brand.

**What merchants get.** A web console for audiences, A/B and multivariate tests, "Dynamic Tests" (ML decisioning that picks variant per user), 1:1 recommendation widgets, and reporting. Similar shape to DY: campaign + variant + segment.

**Latitude.** Insert + A/B + rank. Decisioning chooses among authored variants; recommendations rank catalog items.

**Seam.** No native BigCommerce connector that we found; integration is typically tag-based with merchant/SI work. Standalone PE-backed company post-2022, smaller scale than DY or Bloomreach.

Sources:
- https://kibocommerce.com/press-events/kibo-spins-off-personalization-business-unit-under-the-monetate-brand/
- https://www.g2.com/products/kibo-personalization-formerly-monetate-and-certona/reviews
- https://www.gartner.com/reviews/market/personalization-engines/vendor/monetate/product/monetate-personalization-platform

### 3.3 Bloomreach (Discovery + Engagement + Content + Clarity)

**Positioning.** The most ambitious incumbent: site search (Discovery), marketing automation (Engagement), headless CMS (Content), and as of 2025/2026 a conversational shopping agent (Clarity) with measurable conversion lift (~9% CVR, ~20% AOV in early-access). Loomi is the AI brand; Clarity is the agent. BigCommerce Elite Technology Partner.

**What merchants get.** Multiple consoles: Discovery merchandising for search/recs ranking, Engagement for journeys + weblayers, Content for structured page authoring, Clarity for chat-agent configuration. Loomi powers ranking and segmentation across all of them.

**Latitude.** This is the platform that comes closest to Aisles' direction and is the most realistic competitor. Discovery is rank-only. Engagement is insert (weblayers, banners, in-session content). Content is a structured CMS (so it has schema), but it is human-authored — not AI-generated. Clarity is conversational generate, but it generates **chat turns and product references**, not page layouts.

**Seam.** Bloomreach does not generate full ecomm surfaces (PDP, PLP, cart) as typed component trees. Clarity is an agent surface that lives alongside the page; it does not own the page composition. Pricing is enterprise; implementation is heavy.

Sources:
- https://www.bloomreach.com/en/products/conversational-shopping-agent
- https://documentation.bloomreach.com/clarity/docs/how-clarity-uses-ai
- https://documentation.bloomreach.com/discovery/docs/bloomreach-discovery
- https://www.bloomreach.com/en/partners/bloomreach-technology-partners/bigcommerce
- https://www.bigcommerce.com/apps/bloomreach/

### 3.4 Salesforce Personalization (Marketing Cloud Personalization, ex-Interaction Studio / Evergage)

**Positioning.** Real-time interaction management inside the Salesforce stack. Daily driver for Marketing Cloud customers who want web/mobile/email personalization on top of Data Cloud.

**What merchants get.** Real-time event ingest, campaign builder, recommendations, A/B testing, and Einstein-driven decisioning. Tightly coupled to Marketing Cloud and Data Cloud.

**Latitude.** Insert + rank + A/B. Same campaign-and-variant model as DY/Monetate; the differentiation is the data graph behind it (Data Cloud, customer 360).

**Seam.** Not BigCommerce-native; reaches BC merchants via Data Cloud connectors and tag-based deployment. Heavy lift outside the Salesforce ecosystem. The product has been renamed twice in five years (Evergage → Interaction Studio → Marketing Cloud Personalization), which surfaces in merchant friction.

Sources:
- https://www.salesforce.com/products/marketing-cloud/customer-interaction/
- https://www.salesforceben.com/salesforce-personalization-vs-marketing-cloud-personalization-key-differences-explained/
- https://trailhead.salesforce.com/content/learn/modules/interaction-studio-basics/meet-interaction-studio

### 3.5 Adobe Target

**Positioning.** A/B and personalization inside Adobe Experience Cloud, increasingly fused with Journey Optimizer and AEP. Adobe shipped an Experimentation Accelerator (beta) and AI Assistants for content/insights through 2025–2026.

**What merchants get.** Activity-based console (A/B, MVT, Auto-Allocate, Auto-Target, Auto-Personalization, Recommendations, Experience Targeting), AI Assistants for hypothesis suggestion and copy, and AEP-powered audiences.

**Latitude.** A/B + insert + rank. Adobe is investing in **AI-suggested experiments and AI-generated copy/imagery for variants**, but the variants themselves are still authored or templated; Target picks between them. This is a "smarter campaign manager," not a layout generator.

**Seam.** Not BigCommerce-native — Adobe's commerce gravity is Adobe Commerce (Magento). Reaches BC via tag/AEP. Pricing is enterprise/Adobe-suite-coupled.

Sources:
- https://business.adobe.com/products/target.html
- https://business.adobe.com/blog/adobe-target-announces-redesigned-user-interface-with-generative-ai-features
- https://experienceleague.adobe.com/en/docs/events/adobe-customer-success-webinar-recordings/2025/target2025/ai-adobe-target

### 3.6 Algolia Recommend

**Positioning.** Developer-first recommendations API (related, FBT, trending, looking-similar) sitting on top of Algolia's search index. Native BigCommerce connector + native Recommend support — one of the cleanest integrations in the BC ecosystem.

**What merchants get.** An API + dashboard for index management, query rules, and merchandising. Recommend ships as widgets / typed result lists; storefront owns rendering.

**Latitude.** Rank only. Algolia explicitly does not compose pages; it returns typed result lists for the storefront to render. Personalization is an add-on that re-ranks based on event streams.

**Seam.** Algolia does not own the campaign layer, segmentation, or experimentation. It expects you to bring those (or stay developer-driven). Pricing is per-request, which is friendly for smaller merchants and predictable at scale.

Sources:
- https://www.algolia.com/doc/integration/bigcommerce/search-settings/recommend
- https://www.algolia.com/search-solutions/bigcommerce
- https://changelog.algolia.com/native-recommend-support-on-bigcommerce-3Yq1H2
- https://www.algolia.com/pricing

### 3.7 Coveo AI-Relevance Platform

**Positioning.** Enterprise AI relevance for B2B and B2C commerce, plus knowledge management. Shipped Conversational Product Discovery in March 2026 — natural-language dialogue embedded in the search engine, built on an "agentic orchestration architecture" with deterministic merchant guardrails.

**What merchants get.** Search/recs ranking, dynamic navigation/facets, query pipelines, and now a conversational layer. Daily driver is Coveo's admin for relevance tuning.

**Latitude.** Rank + conversational generate. The agentic layer interprets shopper intent and pulls products from inventory; merchant retains layout control and content guardrails. So Coveo is doing more than ranking, but the "generation" is **conversational responses over a search tool**, not full surface composition.

**Seam.** No documented native BigCommerce connector — reaches BC via Push API / SDK / SI. Strong native partnerships with Salesforce and Sitecore.

Sources:
- https://www.coveo.com/en/platform
- https://www.coveo.com/en/solutions/ecommerce-search-platform/personalization
- https://www.prnewswire.com/news-releases/coveo-redefines-ecommerce-discovery-with-search-native-conversational-ai-302720097.html

### 3.8 Klevu (Athos Commerce)

**Positioning.** Mid-market AI search + merchandising, recently merged with Searchspring and Intelligent Reach to form Athos Commerce. Native BigCommerce app.

**What merchants get.** Smart search, category merchandising, recommendations, a personalization engine, and A/B/MVT for merchandising decisions. Headless-compatible API.

**Latitude.** Rank + insert recs. Personalization "of all pages" is marketing language for ranking + recommendation insertion across home/PLP/PDP/checkout — the storefront still owns layout.

**Seam.** Klevu's pitch is mid-market simplicity; it is not aimed at composing whole experiences or replacing campaign tools. Athos consolidation may produce a fuller product suite over the next 12–24 months.

Sources:
- https://www.klevu.com/
- https://www.klevu.com/capabilities/personalization-engine/
- https://www.bigcommerce.com/apps/klevu-search/

### 3.9 Constructor.io

**Positioning.** AI-native product discovery — search, browse, recs, collections, quizzes, attribute enrichment, AI shopping assistant — explicitly trained against business outcomes (revenue, conversion) rather than relevance. Native BigCommerce connector. Customers include Sephora, Petco, Birkenstock.

**What merchants get.** Constructor dashboard for unified discovery merchandising, plus typed APIs for each surface. Pricing often outcome-tied.

**Latitude.** Rank across all discovery surfaces, with a unified signal layer that shares context between search and browse. Adds quizzes and an AI shopping assistant. Still rank-shaped — does not compose the surrounding page.

**Seam.** Constructor is the most credible "AI-native" challenger in discovery, but it is discovery-shaped: it ranks and routes; it does not generate layouts. Not a campaign/experimentation tool.

Sources:
- https://constructor.com/
- https://constructor.com/ai-ecommerce-core
- https://www.bigcommerce.com/apps/constructor-connect/
- https://docs.constructor.com/docs/integrating-with-constructor-platform-connectors-catalog-connectors-bigcommerce-connector

### 3.10 Optimizely Web Experimentation

**Positioning.** The category-defining experimentation platform; less a personalization engine than an A/B and feature-flag tool that has personalization rules layered on top. Shipped an MCP server and Opal AI agents in 2025–2026 for AI-driven experiment ideation.

**What merchants get.** Visual variation editor, audience builder, A/B/MVT/bandits, server-side or edge delivery to avoid flicker.

**Latitude.** A/B between hand-authored variants. Personalization rules pick a variant for an audience. Optimizely does not generate or rank — it routes among human-built variants.

**Seam.** Optimizely depends on the merchant authoring variants and defining hypotheses. Less useful as a stand-alone personalization layer for mid-market merchants without a strong experimentation discipline.

Sources:
- https://www.optimizely.com/products/web-experimentation/
- https://support.optimizely.com/hc/en-us/articles/23949705057421-2026-Optimizely-Web-Experimentation-release-notes

### 3.11 Klaviyo (predictive personalization, bonus mention)

**Positioning.** Email/SMS marketing platform with strong predictive analytics (CLV, churn risk, next-order date) and AI-generated segments via natural language. Native BigCommerce app. Per-active-profile pricing.

**What merchants get.** Campaign + flow builder, segmentation (now natural-language-driven), predictive scores per profile, dynamic content blocks in email.

**Latitude.** Insert + rank inside email/SMS surfaces; segment generation via AI. Not a web-page personalization engine — adjacent to the engine layer, not competitive with it.

**Seam.** Off-site channel; on-site personalization requires another product.

Sources:
- https://www.klaviyo.com/solutions/ai
- https://www.klaviyo.com/features/segmentation
- https://help.klaviyo.com/hc/en-us/articles/360020919731

### 3.12 Shopify Magic / Sidekick (bonus mention, not BC-addressable)

**Positioning.** Shopify-only AI assistant + content generation + (claimed) generated storefronts. Sidekick can generate custom apps inside Shopify admin using Polaris + GraphQL. Magic generates copy and predicts intent.

**What merchants get.** Embedded AI in the Shopify admin; theme-aware generation; merchant-facing chat-style admin.

**Latitude.** Generate (copy, apps, micro-experiences) — but only inside Shopify. Public claims about "every visitor sees a unique storefront" are aspirational marketing; the production behavior is mostly content generation and ranking.

**Seam.** Not addressable for BigCommerce merchants. Worth noting because it is the loudest "AI-native commerce" voice and shapes merchant expectations.

Sources:
- https://www.shopify.com/magic
- https://www.shopify.com/news/winter-26-edition-renaissance

---

## 4. Where Aisles fits

**The category shape, restated honestly.** Personalization engines are overwhelmingly **rank + route + A/B** systems. The merchant authors variants and segments; the engine picks. The "AI" investment in the last 12 months has gone into (a) better ranking models, (b) AI-suggested experiments and AI-generated copy/imagery to *feed* the variant pipeline, and (c) conversational/agentic layers that live next to the page (Bloomreach Clarity, Coveo Conversational Discovery). **Nobody in this set generates whole ecomm surfaces — PDP, PLP, search, cart, empty/404 — as typed component trees that the storefront renders directly.** That is genuinely an open lane.

**Where the wedge is real.** Aisles' defensible position has three legs, and only the combination is novel:

1. **Composition latitude.** Aisles generates the surface, not just blocks within it. Every other player in the matrix is at "insert" or "rank" latitude; Bloomreach Clarity and Coveo Conversational get to "conversational generate" but only inside a chat surface. If we ship PDP/PLP/cart/empty composition under a typed schema, we are alone at that latitude in the BigCommerce ecosystem.
2. **Schema-typed correctness (the V invariant).** Constructor, Algolia, and Klevu return typed result lists; Bloomreach Content has typed pages; Shopify Sidekick respects Polaris. None of them combine schema-typed *composition* output with AI generation — they either type the data and let humans compose, or they let AI generate free-form text. Schema-validated layout output that always renders is a credibility asset, especially for a category that has been burned by AI hallucination.
3. **BigCommerce-native architecture.** Algolia, Klevu, Constructor, and Bloomreach all have native BC apps; the personalization incumbents (DY, Monetate, Salesforce, Adobe, Optimizely) reach BC via tag/SI. If commerce.com positions Aisles as the BC-native AI composition layer — provisioned through the BC ecosystem, fed by BC catalog + customer events — that is a real moat against the incumbents and a meaningful upgrade over the discovery-only natives.

**Where the wedge is contested or narrow.** Three honest concerns:

- **Bloomreach is the closest competitor and is moving fastest.** Loomi + Clarity + Content + Discovery is a more complete suite than what Aisles ships today; if Bloomreach extends Clarity's agentic framework to compose page surfaces (not just chat turns), our differentiation collapses to "BC-native and cheaper." Watch this through 2026.
- **Constructor's outcome-trained ranking is a strong proof point.** If commerce.com's pitch is "AI-native commerce," Constructor will be in every competitive deal claiming the same thing. Our answer has to be that Constructor is rank-only; Aisles composes. That is a real distinction but requires merchants to understand the latitude axis, which they do not yet.
- **The "merchants want predictable variants" problem is real.** Incumbents do not generate surfaces because their merchants do not want surprise layouts in production. If Aisles cannot give merchants tight, auditable control over what the AI is allowed to compose, the typed-schema story becomes a liability ("the AI built something we didn't approve") rather than an asset. Telemetry, override, and approval workflows are not nice-to-haves — they are part of the wedge.

**A competitor's honest critique.** "Aisles is a research demo dressed up as a product. They are betting that merchants will accept generated layouts; the market has told us for ten years that merchants want WYSIWYG and approvals. Their schema gives them correctness but not control. They have no campaign console, no experiment framework, no segmentation product, no email/SMS surface. They are a feature, not a platform — and the moment Bloomreach or Constructor adds layout composition, that feature is undifferentiated." This is the steel-man we need to beat.

---

## 5. Open questions for product leadership

1. **Latitude ceiling.** Do we commit to "Aisles composes whole surfaces under a typed schema" as the wedge, or do we hedge into "Aisles inserts AI-generated blocks at named anchors" so we look more like the incumbents and lower merchant adoption risk? These are different products.
2. **Merchant control surface.** What is our answer to merchant approval, override, and audit? If a merchant cannot pin a layout for a campaign, freeze a variant for a regulated geo, or roll back an AI decision, we will lose enterprise deals to Bloomreach and Adobe regardless of how good the composition is. Is this a v1 requirement or a v2 deferred?
3. **Experimentation story.** Do we build A/B/bandit infra inside Aisles, integrate with Optimizely/Adobe Target, or punt? Personalization without measurement is a non-starter at enterprise. Our generated surfaces are also harder to measure than variant-routed ones — every render is potentially unique.
4. **Multi-brand / multi-region as table stakes vs. differentiator.** Bealls is one brand; commerce.com's larger pitch is the BigCommerce ecosystem. If multi-brand is core to the GTM, schema-per-brand and prompt-per-brand need to be first-class in the engine, not a layer above. Where does this sit in the roadmap?
5. **Where the AI cost curve breaks.** Per-decision LLM calls scale linearly with traffic. Bloomreach Clarity is enterprise-priced; Algolia Recommend is $0.60/1k requests. What is Aisles' unit economics target, and at what merchant scale does layout caching stop being sufficient? This shapes whether the engine layer is a margin business or a loss-leader for the broader commerce.com platform.

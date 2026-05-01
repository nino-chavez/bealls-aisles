# Admin / Control Plane — Competitive Survey

BigBlueprint Stage 1 cross-industry research for the merchant-facing admin layer of Aisles.

**Audience:** commerce.com product leadership.
**Purpose:** Catalog how merchant-facing control planes look in practice (rule authoring, content authoring, experimentation, observability, role/permission models) so we can specify what `aisles-admin` should ship.
**Date:** 2026-04-30.

---

## 1. Current `aisles-admin` State

Repo found at `/Users/nino/Workspace/dev/wip/aisles-admin/`. Next.js 16 + BigDesign UI + Neon Postgres + Upstash Redis + Vercel. The app installs into BigCommerce as an embedded iframe via OAuth (`/api/auth`, `/api/load`, `/api/uninstall`) and routes the merchant to `/stores/{storeHash}` once the JWT is verified.

**What is built today:**

- **Tab 1 — Merchandising Rules** (`src/components/tabs/RulesTab.tsx`). A flat `Table` of rules with a modal-based create form. Supported rule types: `pin`, `exclude`, `boost`, `seasonal`. Form fields: rule type, persona dropdown (Gatherer / Hunter / Researcher / Gifter), category slug (free-text), product ID (free-text for pin/exclude), campaign tag, optional starts/expires dates. Active-toggle Switch per row, delete button, no edit. Campaigns auto-derived from rules and exposed as group-toggle. A "Flush Layout Cache" button calls `DELETE /stores/{storeHash}/api/cache`. Rules persist in `merchandising_rules` (Neon) and the storefront reads them into the layout prompt at generation time.
- **Tab 2 — Analytics** (`AnalyticsTab.tsx`). Reads `generation_logs` via `/api/analytics?days=N`. Six stat cards (Generations, Today's Cost, Period Cost, Cache Hit Rate, Cache Savings, Tokens), three tables (By Persona, By Generation Type, Daily Trend), and CSV export. No chart library.
- **Tab 3 — Layout Preview** (`PreviewTab.tsx`). Storefront selector (Haven / Volt / Ember), persona selector, category-path text input. Builds a URL `{storefrontBase}/{category}?intent={persona}` and opens it in a new tab. Includes a "Gatherer vs Hunter split-screen" two-window opener. No in-app iframe preview, no rule-impact visualization.
- **Auth** Cookie-based JWT (`jose`), partitioned cookies for iframe context, store credentials in Upstash. Only the BC-installed user is authenticated; no internal RBAC.

**What is specced but not built:**

- Tab 4 (AI Cost Dashboard) listed in the spec — currently folded into the Analytics tab as stat cards only.
- BC Developer Portal registration is manual / pending.
- Storefront integration of rules into `buildLayoutPrompt` is wired (see `aisles-storefront/src/lib/server/layout-prompt.ts`), but rule-impact attribution is not.

**What is missing entirely (gap to V1):**

- No rule **edit** flow (create + delete + toggle only).
- No rule **conflict detection** (two `pin` rules for the same persona+category position will collide silently).
- No **explainability surface** — merchant cannot ask "why did the AI show this layout to a Hunter?" The system writes `generation_logs` but the admin does not surface the reasoning chain, prompt inputs, or which rules fired.
- No **A/B experimentation** primitive at all.
- No **content authoring** — brand voice, hero copy, persona descriptions are hard-coded in the storefront's `lib/brand/config.ts`.
- No **audience builder** beyond the four hard-coded personas.
- No **multi-user / RBAC** — all BC users on the store have full access.
- No **preview-before-publish** for rules. A new rule fires immediately on the next cache miss; the merchant cannot stage a rule against a sample session.
- No **audit log** of who changed what.
- No **multi-brand / multi-region** scoping. Storefront switching exists in Preview but is not first-class in rules.

The app is a thin v0.1 — three tabs, four rule types, four hard-coded personas, no governance. The rest of this document benchmarks the field and proposes the V1 shape.

---

## 2. Executive Summary

Merchant control planes for AI-personalized commerce cluster around four archetypes: the **rule-builder** (Dynamic Yield, Monetate), the **experiment-builder** (Optimizely, VWO, Adobe Target), the **content-authoring CMS** (Contentful, Sanity, Storyblok, Builder.io), and the **analytics dashboard** (Mixpanel, Amplitude, Heap). No incumbent does all four equally well; merchants stitch them together with integrations.

The shape of "merchant control of AI personalization" today is: a **predicate-based audience builder** (boolean tree of attribute conditions), a **WYSIWYG or block-based variation editor**, a **scheduling layer** (start/end, geo-fence, traffic %), and a **results dashboard** with statistical-significance reporting. The frontier is **AI-decided activities** (Adobe Auto-Target, Auto-Allocate; Dynamic Yield Predictive Targeting) — but these systems remain notoriously **opaque**: the merchant sees lift but cannot interrogate "why did Hunter X get layout B instead of A?"

This is the explainability gap. Constructor.com's Merchant Intelligence Agent (MIA) is the only vendor explicitly marketing transparency-as-a-feature in 2026, and it is a thin layer over an otherwise black-box ranking system. **Aisles' generative approach (LLM-authored layouts) creates a structurally better explainability story than recommendation-ranker peers** — the prompt is auditable, the inference reasons are emittable, and the rule-injection is visible. We should treat explainability as the defensible product wedge, not a nice-to-have tab.

---

## 3. Comparison Matrix

| Tool | Rule authoring UX | Content authoring | Experimentation | Audience builder | Permissions | Preview | Telemetry | Multi-brand |
|---|---|---|---|---|---|---|---|---|
| **BigCommerce native** | Promotion editor (form-based, segment targeting) | Page Builder (block-based, per-storefront) | None native; via apps | Customer Segmentation API (1000 segments / shopper) | Multi-user with role packages | Storefront preview tokens | Built-in store insights, basic | Multi-storefront via channels |
| **Shopify native** | Customizer (theme editor with section targeting) | Sections/blocks in theme editor; metaobjects | Shopify Audiences + apps | Customer segments (filter DSL) | Staff permissions, granular | Theme preview links, unpublished themes | Shopify Analytics, Live View | Markets (per-region overrides) |
| **Dynamic Yield** | No-code merchandising rule builder; predicate tree for targeting; Experience APIs for server-side | Dynamic Content (replace static blocks); template library | A/B + multi-variate + Predictive Targeting (ML) | Audience Hub: rules + Predictive Audiences (ML lookalike); Audience Explorer | Role-based, enterprise-grade | Preview mode per experience | Per-experience reports, variation lift, segment performance | First-class multi-site |
| **Monetate** | Action Builder (visual; insert/edit/lightbox) + action conditions | Action Builder (DOM-injected blocks) | A/B + multi-armed bandit | Segment Builder (rule-based) | Role-based | Preview mode | Experience reports, incrementality | Multi-site |
| **Optimizely Web Exp.** | New Visual Editor (overlay-based, attribute targeting), conditional activation | Visual edits + DAM-uploaded media | First-class A/B; Stats Engine (sequential testing) | Audience builder (attribute conditions, Optimizely Data Platform) | Opti ID Admin Center, RBAC | Preview mode + share link | Metric Impact Report, confidence intervals, winning/inconclusive | Multiple projects per Opti ID |
| **Adobe Target** | Activities (A/B, XT Auto-Target, Auto-Allocate, AP Automated Personalization, Recs, Experience Targeting) | VEC (Visual Experience Composer) + Form-based; Offers library | A/B + XT (Random Forest ML) + Auto-Allocate (multi-armed bandit) + AP | Audiences (rule + AAM imported + ML); Profile script | Workspaces (geo or team scoped); enterprise permissions; properties | VEC preview, QA links | Activity-level reports + confidence; lift per audience | Workspaces; Properties = channel |
| **Contentful** | N/A (CMS, not personalization) | Content models (Types + Fields), references, locales | N/A native; via addons | N/A | RBAC: Admin/Developer/Editor/Author + Workflows roles + content permissions | Preview API (draft) | Webhook + API logs; minimal | Multi-space + environments |
| **Builder.io** | Personalization rules + targeting tied to content blocks | Real-time visual editor, drag-drop, registered components | A/B + personalization on any block | Targeting attributes (custom) | Granular RBAC (developer/designer/writer/PM) | Live in-editor preview | Per-page conversion + heatmaps; Builder Insights | Spaces |
| **Sanity** | N/A (CMS) | Code-defined schemas; Studio is React-customizable; Presentation tool with click-to-edit | N/A native | N/A | Roles + dataset-level | Presentation tool live preview; Content Source Maps | N/A | Multiple datasets / workspaces |
| **Storyblok** | Targeting via field rules + plugins | Visual Editor with component blocks; nestable | Beta / via integrations | Field-level + roles | RBAC + workflows + approvals | Built-in live preview, click-to-edit | Minimal | Spaces |
| **VWO** | Rules engine: Rollout / Testing / Personalize; visual editor | DOM mutations via visual editor | First-class A/B + multivariate + feature experimentation | Segment builder (attributes, location, behavior) | Role-based | Preview mode, share preview link | Bayesian + frequentist reports; SmartStats | Multi-site |
| **Convert.com** | Rule-based audiences + visual editor | Visual editor (DOM) | A/B + MVT + split URL | Audience targeting (geo, device, custom JS) | RBAC | Preview mode | Stats + heatmaps | Multi-site |
| **Mixpanel / Amplitude / Heap** | N/A (analytics) | N/A | A/B reporting integrations | Cohorts (event-based filters) | RBAC + workspaces | N/A | Funnels, retention, paths, session replay (Heap), Spark AI / Amplitude AI for natural-language queries | Projects |

---

## 4. Per-Tool Deep Dives

### BigCommerce Native Admin

**Who:** Every BC merchant, default-on. **Daily-driver:** Order management, product catalog edits, promotions, theme/Page Builder edits. **Distinguishing strength:** Customer Segmentation API supports up to 1,000 segments per shopper with attribute-based targeting, exposed in the Promotions Manager for native promotion targeting; multi-storefront via channels is first-class. Page Builder is the visual-block editor for storefront content. **Weakness:** No native experimentation (third-party apps fill the gap), no native AI personalization control surface — exactly the gap Aisles fills. Aisles slots in as a marketplace app sibling to BigCommerce's own merchandising tools, not a replacement.

### Shopify Admin

**Who:** Every Shopify merchant. **Daily-driver:** Theme editor (Customizer), order/inventory management, product edits. **Distinguishing strength:** Sections-and-blocks theme architecture is the cleanest visual-section model in mainstream commerce — a section defined once shows everywhere, with merchant overrides per template. Markets (per-region pricing/content), Shopify Audiences (ad targeting), Customer segments DSL. The Customizer is widely cited as the gold standard for "merchant edits without dev." **Weakness:** Shape-locked: merchants get sections defined by the theme; deviating means a custom theme. Personalization beyond segments requires apps. Aisles' AI-generated layout is a category Shopify does not natively address.

### Dynamic Yield (Mastercard Experience OS)

**Who:** Mid-market and enterprise retailers. **Daily-driver:** Audience Hub + Experience composer + Recommendations. **Distinguishing strength:** No-code merchandising rule builder for product recs (real-time filters, dedupe, OOS exclusion, custom filter rules via Experience APIs); Predictive Targeting (ML-driven audience lookalikes); Dynamic Content campaigns swap any static block. Tight coupling between rules, experiences, and recs is the platform's selling point. **Weakness:** Notoriously opaque — the "why did this experience win" answer reduces to lift-percentage charts, not causal/feature-attribution explanations. Implementation is heavy; it is not a self-serve product. This is the explicit "magic black box" Aisles competes against.

### Monetate

**Who:** Enterprise retail (Mercatus segment). **Daily-driver:** Action Builder for site changes + Audience Builder for targeting + Experience reports. **Distinguishing strength:** Action Builder splits cleanly into "insert content" vs "edit content" actions with a Data Collect ("do nothing") action for pure measurement and a Simulate Click action — small primitives that compose well. Action conditions add a granular layer of "fire only when X" gating. **Weakness:** DOM-injection model means actions can break under theme upgrades; rule sprawl across "experiences × actions × conditions" is hard to reason about at scale. Multi-armed-bandit support exists but is opaque to the merchant.

### Optimizely Web Experimentation

**Who:** Growth / CRO teams across SaaS and commerce. **Daily-driver:** Experiment list, Visual Editor, results page. **Distinguishing strength:** The new Visual Editor (overlay-based, no iframe) supports advanced attribute targeting (Exact / Contains / Prefix / Partial / Starts with / Ends with operators) and conditional activation. Stats Engine produces sequential-testing-safe statistical significance with always-valid p-values, and the Metric Impact Report aggregates lift across experiments. Roles managed via Opti ID Admin Center. **Weakness:** A/B is the world; personalization is a separate product. Visual edits are CSS/DOM-bound — they cannot drive a generative layout. Aisles can learn the results-page UX (winning / inconclusive states, confidence intervals) wholesale.

### Adobe Target

**Who:** Adobe Experience Cloud customers, enterprise. **Daily-driver:** Activities list (A/B, XT, Auto-Allocate, AP, Recs, Experience Targeting) + VEC + Audiences. **Distinguishing strength:** The richest activity-type taxonomy in the field. Auto-Target uses Random Forest to pick the best of N marketer-defined experiences per visitor; Auto-Allocate is a multi-armed bandit (80/20 traffic split, kicks in at 1,000 visitors + 50 conversions per arm); Automated Personalization composes offers across slots. Workspaces enable geo or team scoping with discrete audiences/offers/activities per workspace. **Weakness:** Steep learning curve; explainability is poor for AP (the "why this combination" is not surfaced); requires Adobe Analytics + AAM for the full audience story. Workspace model is a useful pattern for Aisles' multi-brand future.

### Contentful

**Who:** Content/marketing teams using a headless CMS. **Daily-driver:** Edit entries, schedule publishes, manage workflows. **Distinguishing strength:** Predefined RBAC (Admin / Developer / Editor / Author) plus Workflow steps with rules that gate editing/publishing per stage. Content Permissions allow field- and entry-level scoping. The Preview API distinguishes draft vs published cleanly. **Weakness:** No native experimentation, no native personalization. Pure content authoring. Aisles can adopt Contentful's role taxonomy and workflow-step concept directly for static-content authoring.

### Builder.io

**Who:** Marketing teams who want visual page-building + light personalization + experimentation. **Daily-driver:** Visual editor, page list, A/B variations on blocks. **Distinguishing strength:** Spans CMS + personalization + experimentation in one tool. Granular RBAC (developer manages component registry; designer edits layouts; writer updates copy; PM publishes/runs experiments) is a clean separation-of-concerns model. Builder CMS MCP Server (2025) exposes content to AI agents. **Weakness:** Generic visual page builders tend to drift toward "shape-of-the-tool wins" — pages look like Builder pages. The targeting/personalization primitives are simple (rules on blocks), not deeply ML-driven.

### Sanity

**Who:** Developer-led content teams who want a customizable Studio. **Daily-driver:** Studio (custom React UI) editing structured content. **Distinguishing strength:** Code-defined schemas and a fully customizable Studio means the editorial UI matches the content model exactly; Content Releases stage changes; Presentation tool offers click-to-edit live preview; Content Source Maps trace "where did this come from?" — a literal explainability primitive at the content layer. Real-time multi-user editing (Google-Docs-like). **Weakness:** Setup-heavy for marketing autonomy; visual editing requires configuration. The Source Maps idea is directly transferable to Aisles' AI-decision explainability.

### Storyblok

**Who:** Marketing-led teams that want Builder.io-style visual editing with a more structured content model. **Daily-driver:** Visual Editor + nested-component composition + workflow approvals. **Distinguishing strength:** Visual Editor is widely praised as the most marketer-friendly in headless CMS; component-level commenting and customizable approval workflows ship out-of-the-box. **Weakness:** No personalization or experimentation natively. Workflow model is a good pattern for Aisles.

### VWO

**Who:** Mid-market CRO teams. **Daily-driver:** Test list, visual editor, results page. **Distinguishing strength:** Three rule types — Rollout, Testing, Personalize — collapse feature-flag, A/B, and personalization into one mental model: a flag with rules. SmartStats (Bayesian) is approachable for non-statisticians. **Weakness:** Visual editor is DOM-mutation; depends on stable selectors. Rule UX gets messy past ~10 rules per flag.

### Convert.com

**Who:** Privacy-focused CRO teams. **Daily-driver:** Test list, visual editor, audience builder. **Distinguishing strength:** Strong privacy/GDPR posture, custom-JS audiences. **Weakness:** Smaller surface area than Optimizely/VWO; adopt for parity not differentiation.

### Mixpanel / Amplitude / Heap

**Who:** PMs, growth, analytics teams. **Daily-driver:** Funnels, retention, cohorts, dashboards. **Distinguishing strength:** Mixpanel's Spark AI and Amplitude AI now answer plain-English questions ("why did signups drop last Tuesday?") over event data, with anomaly detection and Slack alerts. Heap differentiates with autocapture + session replay. Cohorts (event-based filters) are the cleanest "audience by behavior" primitive in the field. **Weakness:** None are merchant-tuned — they are PM tools. The natural-language query UX is the right pattern for Aisles' observability tab ("which rules fired most for Hunters last week and what was the conversion impact?").

---

## 5. Patterns and Anti-Patterns

**Worth copying:**

- **Predicate trees for audiences/rules** (Dynamic Yield, Optimizely, VWO). A boolean tree of `{attribute, operator, value}` clauses is the universal interchange format. It is JSON-serializable, diff-able, copy-pasteable across environments, and visually renderable as nested cards. Aisles should standardize a single predicate schema for both rule targeting and audience definition rather than diverging.
- **Workspaces / Properties / Spaces** (Adobe Target, Contentful, Builder.io). Multi-team and multi-brand scoping is best-modeled as discrete workspaces with their own audiences/rules/activities. Aisles will have multi-brand customers; bake this in V1, do not bolt on later.
- **Activity-type taxonomy** (Adobe Target). Distinct activity types — A/B, XT, Auto-Allocate, AP, Experience Targeting, Recs — with different decision algorithms per type. Aisles' rule types (`pin`, `exclude`, `boost`, `seasonal`) are an analogous taxonomy; expand it rather than collapsing into one generic "rule".
- **Stats Engine / SmartStats** (Optimizely, VWO). Always-valid sequential testing solves the "merchant peeks at results early and ships a false winner" problem. If Aisles ships A/B in V1, use a sequential-testing engine, not naive frequentist p-values.
- **Sanity Content Source Maps + Presentation tool**. "Where did this come from?" traceability is rare in the field and structurally fits Aisles' generative model.
- **VWO's three-rule-type unification** (Rollout / Testing / Personalize). Treats feature flags, A/B tests, and personalization as one mental model — a flag with rules. Aisles' admin should converge rules + experiments + scheduled overrides under one rule taxonomy.
- **Workflow steps with publish gating** (Contentful). Draft / Review / Approved / Published states with role-bound transitions prevent merchandiser-vs-brand-manager conflicts.
- **Natural-language query** (Mixpanel Spark, Amplitude AI). The right shape for the observability tab — "which rules fired most for Hunters last week" beats hand-built dashboards.
- **Builder.io role separation** (developer / designer / writer / PM). A clean role decomposition that maps directly to Aisles' personas.

**Worth avoiding:**

- **DOM-injection rule UX** (Monetate, VWO, Convert visual editors). Brittle under theme upgrades, hostile to a generative-layout system. Aisles should never go down this path — the engine renders, not the admin.
- **"Magic" auto-personalization with no explainability** (Adobe AP, Dynamic Yield Predictive). Merchants stop trusting the system. Aisles' wedge is the opposite: every layout decision should be explainable.
- **Visual-builder-that-tries-to-do-too-much** (early Builder.io, generic page builders). Pages drift toward looking like the tool. Aisles' content authoring should constrain to brand voice + persona description + block templates, not free-form layout.
- **Silent rule conflicts** (current `aisles-admin`). Two `pin` rules for the same persona+slot will collide silently. Surface conflicts at write time, not in production logs.
- **Flat rule lists with no grouping** (current `aisles-admin`). Past ~20 rules a flat table becomes unusable. Group by campaign / persona / category / status from V1.
- **Naive frequentist stats** with peek-warning. If experimentation ships, use sequential testing.
- **Per-tab analytics with no cross-link** (current Mixpanel-style dashboards in commerce admins). Merchant sees "rule fired 1,200 times" in one tab and "conversion +2%" in another with no causal link. Aisles should attribute conversion lift back to the rule that caused it.

---

## 6. Implications for `aisles-admin`

**Recommended primary daily-driver shape: a "Decisions Inspector," not a rule library.**

Rule-builder admins (Dynamic Yield, Monetate) optimize for the "I want to add a rule" workflow. But the actual daily question for an Aisles merchandiser is not "what rule should I add?" — it is "the AI just generated a layout; what did it do, and why?" The primary tab should be a chronological feed of recent layout generations with a per-row "explain this decision" drilldown that shows: persona inferred, signals used, rules that fired, prompt sent, layout returned, conversion outcome (if observed). This is structurally impossible for ranker-based competitors (Dynamic Yield, Monetate) because they cannot serialize the reasoning of an opaque ML model. It is structurally trivial for Aisles because the prompt and response are already logged. **This is the wedge.** Rule authoring is a secondary tab; explainability is the homepage.

**Permission model: workspaces + role packages, not flat per-store admin.**

Adopt Contentful's role taxonomy (Admin / Developer / Editor / Author / Analyst) scoped within Workspaces (per brand or per region). Bealls would have one workspace per banner; agencies would have a workspace per client. This is V1-mandatory because retrofitting permissions later is ten times the work. Map roles to Aisles concepts: Admin = full; Merchandiser = create/edit rules + view analytics; Brand Manager = edit brand voice + persona descriptions, no rule access; Analyst = read-only on telemetry; Developer = manage integrations and webhooks. Add Workflow steps for Brand Manager edits (Draft → Review → Published) but NOT for rules — rules need to ship fast during a campaign.

**Explainability is the product, not a feature.**

Three layers, all surfaced in the admin:

1. **Decision-level** (per layout generation): inferred persona, signal trace, rules fired, prompt sent, response returned, cache-hit/miss, cost. Already logged; needs a UI.
2. **Rule-level** (per rule): impressions, conversions attributed, conflicts detected, last-fired timestamp, average cost when fired. Treats every rule as a measurable activity, like Adobe Target activities.
3. **System-level**: the prompt template, the rule-injection format, the model fallback chain (Haiku vs Sonnet). Merchants should be able to see the actual prompt sent for any decision. Borrow Sanity's Content Source Maps idea — every block in a layout traces back to "this rule + this signal + this prompt section."

The competitive narrative writes itself: "Dynamic Yield tells you what won. Aisles tells you why."

**Path from current state to V1:**

1. **Now → 4 weeks:** Add rule edit + conflict detection + rule grouping (campaign/persona/category) + audit log. Replace flat table with a grouped list. Make the empty state useful (templated rule starters: "Holiday hero pin," "Clearance exclude for Gatherers").
2. **4 → 8 weeks:** Build the Decisions Inspector tab. Read `generation_logs`, render a chronological feed, add a per-row drilldown showing inferred persona / signals / rules / prompt / response. This is a read-only feature that ships independently of any new write paths.
3. **8 → 12 weeks:** Workspaces + RBAC. Migrate single-store-multi-user model to workspace-scoped roles. Add Brand Manager surface for brand voice and persona descriptions (currently in `lib/brand/config.ts`) — these need to move to a Postgres table with a Contentful-style draft/publish workflow.
4. **12 → 16 weeks:** Audience builder beyond hard-coded personas. Predicate-tree UI over signal attributes (recency, frequency, category affinity, intent score). Audience preview ("how many sessions matched this audience in the last 7 days?") borrowing Dynamic Yield's Audience Explorer pattern.
5. **16 → 20 weeks:** Experimentation primitive. Two-arm A/B on rule sets with sequential-testing stats. This unlocks "test layout A vs layout B for Hunters in Outdoor."
6. **Parallel track:** Multi-brand. The Preview tab already supports three storefronts; bake the brand axis into rules, audiences, telemetry, and roles.

---

## 7. Open Questions for Product Leadership

1. **Is Aisles a BigCommerce app or a multi-platform AI personalization product?** The current admin is BC-iframe-bound. If the latter, we need a platform-agnostic auth/embed model (Shopify app embed, headless API surface). This decision gates the workspace model.
2. **What is the V1 monetization story for the admin?** Per-seat (favors RBAC depth)? Per-decision (favors observability)? Per-rule-fired? The pricing model should drive what we instrument first.
3. **How much of the explainability surface is merchant-facing vs end-customer-facing?** Empathy.co and Constructor MIA argue both. Do shoppers see "why this layout"? If yes, the admin needs a public-explainability toggle and shopper-friendly copy generator.
4. **Do we ship experimentation in V1, or punt to "rules + observability" first?** Experimentation requires sequential-testing stats infrastructure, traffic-allocation logic, and a results page — at least 6 weeks of work. The lower-effort move is "compare two rule sets via observability" and skip formal A/B until V1.5.
5. **What is the agency model?** Bealls won't run Aisles solo; an agency partner will. Do we need a "manage many merchants from one login" surface (like an MSA model)? This changes the auth model from per-store to per-user-with-store-list.
6. **Do brand voice and persona descriptions belong in `aisles-admin` or in a separate "Brand Studio" surface?** The current spec puts them in admin, but they are content-authoring concerns with a different cadence and editor profile (brand manager, not merchandiser). A Builder.io-style two-tool split (rule console + content studio) may be cleaner long-term.

---

## Sources

- [Dynamic Yield Experience OS](https://www.dynamicyield.com/experience-os/)
- [Dynamic Yield Audience Hub (KB)](https://support.dynamicyield.com/hc/en-us/articles/360022734273-Audience-Hub)
- [Dynamic Yield Targeting (KB)](https://support.dynamicyield.com/hc/en-us/articles/360022725293-Targeting)
- [Dynamic Yield Predictive Targeting](https://www.dynamicyield.com/predictive-targeting/)
- [Dynamic Yield Custom Filter Rules (KB)](https://support.dynamicyield.com/hc/en-us/articles/360022549994-Recommendation-Custom-Filter-Rules)
- [Monetate Action Builder Overview](https://docs.monetate.com/docs/action-builder-overview)
- [Monetate Building Actions](https://docs.monetate.com/docs/actions)
- [Optimizely New Visual Editor](https://support.optimizely.com/hc/en-us/articles/37424389168013-New-Visual-Editor)
- [Optimizely Advanced Targeting with Attributes](https://support.optimizely.com/hc/en-us/articles/42224729155469-Advanced-targeting-with-attributes)
- [Optimizely 2025 Web Experimentation Release Notes](https://support.optimizely.com/hc/en-us/articles/42893956457357-2025-Optimizely-Web-Experimentation-release-notes)
- [Optimizely Statistical Significance](https://support.optimizely.com/hc/en-us/articles/4410284003341-Statistical-significance)
- [Optimizely Experiment Results page](https://support.optimizely.com/hc/en-us/articles/4410284017421-Optimizely-Experiment-Results-page)
- [Optimizely Roles and Permissions](https://support.optimizely.com/hc/en-us/articles/15858154659853-Roles-and-permissions)
- [Adobe Target Workspaces (KB)](https://experienceleague.adobe.com/en/docs/experience-cloud-kcs/kbarticles/ka-17521)
- [Adobe Target Auto-Target (XT)](https://experienceleague.adobe.com/en/docs/target/using/activities/auto-target/auto-target-to-optimize)
- [Adobe Target Auto-Allocate](https://experienceleague.adobe.com/en/docs/target/using/activities/auto-allocate/automated-traffic-allocation)
- [Adobe Target Activity Types](https://experienceleague.adobe.com/en/docs/target/using/activities/target-activities-guide)
- [Contentful Workflows Roles and Permissions](https://www.contentful.com/help/ai-automations/workflows/workflows-roles-and-permissions/)
- [Contentful Workflow Rules](https://www.contentful.com/help/workflow-rules-edit-publish-permissions/)
- [Contentful Roles Best Practices](https://reintech.io/blog/contentful-roles-permissions-securing-content)
- [Builder.io Visual Editor Docs](https://www.builder.io/c/docs/visual-editor)
- [Builder.io 2025 Review](https://digitalsoftwarelabs.com/ai-reviews/builder-io/)
- [Sanity vs Storyblok (Webstacks)](https://www.webstacks.com/blog/sanity-vs-storyblok)
- [Sanity Storyblok comparison (Sanity)](https://www.sanity.io/storyblok-vs-sanity)
- [VWO Visual Editor](https://help.vwo.com/hc/en-us/articles/360021535813-Using-Visual-Editor-to-Create-Variations)
- [VWO Set Up Rules in Feature Experimentation](https://help.vwo.com/hc/en-us/articles/46347563022233-Set-Up-Rules-in-Feature-Experimentation)
- [BigCommerce Customer Segmentation](https://developer.bigcommerce.com/docs/store-operations/customer-segmentation)
- [Shopify Theme Editor Features Overview](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/features-overview)
- [Shopify Sections and Blocks](https://help.shopify.com/en/manual/online-store/themes/theme-structure/sections-and-blocks)
- [Mixpanel vs Amplitude](https://mixpanel.com/compare/amplitude/)
- [Heap vs Amplitude vs Mixpanel](https://userpilot.com/blog/heap-vs-amplitude-vs-mixpanel-for-product-analytics/)
- [Constructor Merchant Intelligence Agent (MIA)](https://constructor.com/solutions/merchant-intelligence-agent)
- [Empathy.co Explainable AI in Retail](https://empathy.co/blog/explainable-ai-in-retail-delivering-trust-transparency-and-personalisation/)
- [Signifyd Explainable AI in Ecommerce](https://www.signifyd.com/blog/explainable-ai-in-ecommerce/)

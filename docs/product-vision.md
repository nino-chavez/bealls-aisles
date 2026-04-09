# Aisles — Product Vision

**Version**: 0.2.0
**Last Updated**: 2026-04-06
**Audience**: Product, Business Stakeholders, Developers

## Mission

Make AI personalization invisible to the shopper and visible to the business user.

A shopper on an Aisles-powered storefront should never notice that the experience is personalized. They see a store that feels right for them — organized the way they browse, showing the depth of detail they care about, with the copy that speaks to their moment. The adaptation is silent.

The business user — a merchandiser, brand manager, or growth lead — sees exactly the opposite. The Observe dashboard shows every signal, every inference rule that fired, every probability shift, and every layout decision. They understand why the store is behaving the way it is, and they have controls to influence it.

This tension — invisible to the shopper, transparent to the operator — is the product's core design principle.

---

## Three-Brand Demo

Aisles ships with three built-in brands that prove the architecture is vertical-agnostic. The same inference rules, layout engine, and AI pipeline serve furniture, electronics, and outdoor goods without modification.

| Brand | Domain | Positioning |
|---|---|---|
| **Haven** | DTC home furniture | Warm, editorial. Emphasizes lifestyle storytelling and aesthetic discovery. |
| **Volt** | Consumer audio & electronics | Technical, spec-forward. Emphasizes performance data and compatibility. |
| **Ember** | Outdoor lifestyle & fire | Rugged, seasonal. Emphasizes activity fit and weather-appropriate bundling. |

The brands share no product data, no BC channel, and no visual identity. They do share the inference engine, the layout component vocabulary, the enrichment pipeline, and the prompt construction logic. A brand is a configuration file — `src/lib/brand/config.ts` — not a fork.

This is intentional positioning for the BC marketplace app: a merchant installs Aisles once and configures their brand. No code changes required.

---

## Business User Personas

Aisles is designed for three business user types. Each has different goals and interacts with different parts of the system.

### Merchandiser

The merchandiser is responsible for what appears on category pages and in what order. Their pain: the default BC sort order is based on creation date or manual ranking. It does not adapt to shopper intent.

With Aisles, the merchandiser runs the enrichment pipeline after adding products. The enrichment scores each product on four persona-fit dimensions (gatherer, hunter, researcher, gifter) and tags it with semantic intent labels. The AI layout engine uses these scores to present high-fit products first. The merchandiser sees the scores in the Observe dashboard's product enrichment panel.

Future: the admin layer (BC marketplace app) will let the merchandiser override persona-fit scores for specific products and pin items to specific positions within a persona layout.

### Brand Manager

The brand manager is responsible for voice, visual identity, and the narrative the store tells. Their pain: AI-generated copy often sounds generic.

The brand config's `prompt.voiceGuidance` field feeds into every layout generation prompt. Haven's voice guidance instructs the model to write "warm, editorial, magazine-like" copy; Volt's instructs it to be "precise and performance-focused." The brand manager owns this field.

Future: the admin layer will expose voice guidance as an editable text field. The brand manager will be able to test changes against live categories without a code deployment.

### Growth Lead

The growth lead is responsible for acquisition and conversion. Their pain: they can see UTM campaign performance in analytics but cannot see how incoming traffic intent maps to layout decisions.

The Observe dashboard exposes per-session signal attribution. A `utm_campaign=holiday-gift` tag on an inbound URL triggers the `utm-gift-campaign` inference rule, shifting the persona toward gifter, which produces a layout with editorial gift framing and curated price tiers. The growth lead can verify this chain without opening the codebase.

Future: the admin layer will surface aggregate intent distributions — what percentage of sessions from a given UTM source land as hunter vs. gifter — so growth leads can calibrate campaign messaging against layout outcomes.

---

## The Admin Layer

The BC marketplace app (tracked separately in `docs/aisles-admin.md`) is the business-user control plane for Aisles. It runs as a BigCommerce embedded app and is the channel through which non-technical users interact with the system.

Planned controls:
- **Brand voice editor**: edit `voiceGuidance` without a code deploy
- **Persona-fit overrides**: pin a product to a persona or suppress it from specific layouts
- **Rule weight tuning**: increase or decrease the influence of specific inference rules per channel
- **Cache invalidation**: force fresh layout generation for a category after merchandising changes
- **Observe access**: view the real-time Observe dashboard from within the BC admin

The admin app is the product's primary commercial surface. The inference engine and layout pipeline are the technology; the admin app is what a merchant buys.

---

## Competitive Positioning

### vs. Amazon's "Frequently Bought Together"

Amazon's recommendation engine is statistical: it identifies items that appear together in purchase histories across millions of orders. "Customers who bought X also bought Y." The correlation is real but the reasoning is opaque. If no one has ever bought two items together, there is no signal.

Aisles uses reasoning-based compatibility. The enrichment pipeline calls Claude Sonnet to evaluate each product against four persona archetypes. The model reasons about material, use case, price tier, and aesthetic fit — not co-purchase frequency. A new product with zero sales history gets correct persona scores on day one.

The distinction matters most for new brands and niche catalogs where statistical co-purchase data does not exist. This is exactly the BigCommerce merchant profile.

### vs. Rule-Based Personalization Platforms (Nosto, Dynamic Yield)

Existing personalization platforms for BC merchants are rule-based: "if the shopper is on mobile and in the furniture category, show the bestsellers widget." Rules require manual maintenance, do not compose well, and cannot produce layout-level changes (only widget-level injection).

Aisles infers intent continuously and uses that intent to drive the entire layout — not a single widget, but the number of columns, the presence or absence of editorial copy, the sort order, and the call-to-action pattern. Layout-level personalization requires an AI that understands composition, not rules that swap products.

---

## What Streaming Platforms Teach Us

Aisles draws explicit inspiration from the personalization systems built by Netflix, Spotify, and Hulu. These are not analogies — they are the most rigorous deployed examples of behavioral personalization at scale. The signal expansion work (see `docs/signals-and-inference.md` and `docs/specs/behavioral-signals.md`) is directly motivated by what these platforms learned.

### Behavior Beats Declared Intent (Netflix)

Netflix does not ask users what they want to watch. It measures what they actually do: watch completion percentage, skip rate during playback, time-of-day viewing patterns, device context, and whether a title was rewatched. Declared preferences (star ratings) were retired because they reflected what users thought they should like, not what they actually engaged with.

For Aisles, this means search queries and UTM tags — the declared signals the current engine uses — are less informative than behavioral signals: how long did the shopper dwell on a product card, did they scroll past it quickly, did they open the refinement chat and then close it without acting?

### Negative Signals Are the Most Informative (Spotify)

Spotify's recommendation system treats a skip as more informative than a play. If a user skips a track in the first ten seconds, that is strong negative feedback. If they let it play to completion, that is weak positive feedback. The asymmetry is intentional: skips reveal preference boundaries; plays confirm existing taste.

For Aisles, the equivalent is: a shopper who removes an item from their cart, scrolls quickly past a product category, or closes the refinement chat without adding anything — these are strong negative signals about what this persona is not. The planned negative signal expansion (`bounce detection`, `cart removal`, `chat abandonment`) directly mirrors Spotify's skip model.

### Continuous Embeddings, Not Fixed Categories (All Three)

Netflix, Spotify, and Hulu all moved away from human-curated genre categories toward continuous embedding spaces. A film is not "action" or "drama" — it is a vector in a high-dimensional space, and users are also vectors. Recommendation is nearest-neighbor lookup in that space.

Aisles takes the same approach at the product level. Each product gets a persona-fit score that is a continuous 0.0–1.0 value, not a binary "for gatherers" flag. A sofa with a gatherer score of 0.91 and a hunter score of 0.42 can appear in both layouts — prominently in a gatherer layout, briefly in a hunter layout. There is no hard exclusion.

### Explore vs. Exploit Tradeoff

All three platforms balance showing content the user is predicted to like (exploit) with showing content that might expand their taste or discover new preferences (explore). Pure exploitation leads to filter bubbles; pure exploration feels random.

Aisles does not yet implement explicit explore/exploit balancing, but the base prior (`gatherer: 0.3, hunter: 0.2, researcher: 0.2, gifter: 0.1`) is a structural expression of this tradeoff. On a cold-start session with no signals, the system defaults to the gatherer persona — the most exploration-friendly layout — rather than a uniform distribution. This is a deliberate choice: browsing is safer than efficiency-mode as a default.

### Session Context: Device, Time, and History

Netflix serves different thumbnails on a phone at 11pm than on a TV on Saturday morning. The same user, the same title, different context. The presentation adapts to the moment.

Aisles implements this via the `mobile-evening-impulse` rule (mobile + late evening → mild hunter boost + urgency) and `desktop-weekday-deliberate` (desktop + business hours → researcher boost). These are coarse proxies for what the streaming platforms do with much richer context. The session arc modeling phase (Phase 5 of the behavioral signal expansion) will build toward tracking persona trajectories across a session rather than inferring a static snapshot per page load.

### Presentation Personalization (Netflix Thumbnail Selection)

Netflix runs A/B tests on thumbnail artwork per user segment. A thriller with an action-oriented thumbnail is shown to users whose viewing history skews action-forward; the same film gets a character-portrait thumbnail for users who engage with character dramas. Same content, different presentation optimized per user.

The Aisles equivalent is already in production: the same product appears as a hero with a lifestyle description in a gatherer layout, and as a compact card with specs only in a hunter layout. The `PERSONA_DEFINITIONS` in `src/lib/server/layout-prompt.ts` encode these presentation rules. The AI selects components and writes copy that matches the presentation style for the inferred persona.

---

## Related Documentation

- `docs/architecture.md` — system architecture and data flow
- `docs/signals-and-inference.md` — signal types and inference rules in detail
- `docs/specs/behavioral-signals.md` — implementation spec for signal expansion
- `docs/multi-brand.md` — brand configuration and setup
- `docs/aisles-admin.md` — BC marketplace admin app (planned)
- `docs/observe.md` — Observe dashboard for business users and demos

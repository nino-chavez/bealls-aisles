# Aisles — North Star

**Version**: 0.4.0
**Last Updated**: 2026-04-30
**Audience**: commerce.com internal teams — product, engineering, customer success
**Example merchant artifact**: Bealls (with family — Bealls Florida + Home Centric)

> **Reframing notes:**
> - **v0.4.0 (2026-04-30 PM):** repositioned from "commercial product for sellable merchant features" to **possibility-prototype experiment** for commerce.com internal teams. The architecture and engine-layer design philosophy are unchanged. What changed: audience (internal teams, not leadership-evaluating-a-product), goal (surface capabilities for our teams to adopt; expose merchant conversations for CS; validate tech patterns for engineering), and how strategic docs frame trade-offs (hypotheses tested + lessons surfaced, not bets/wedges/positioning).
> - **v0.3.0 (2026-04-30 AM):** initial three-layer reframing. Preserved verbatim in §3.x.
> - **v0.2.0 (2026-04-06):** single-layer engine-only vision. Preserved verbatim in §3.1.

---

## 1. What Aisles is

**A possibility-prototype experiment that surfaces what's possible when an AI composition engine, a complete ecomm app foundation, and a merchant control plane are bundled into one BigCommerce-native artifact.**

Aisles is not a product we are selling. It is an artifact our internal teams react to. Three audiences, three extractions from the same artifact:

| Audience | Question this artifact answers |
|---|---|
| **Product** | What merchant-facing capabilities does this surface that we should adopt into our actual roadmap? |
| **Engineering** | What architectural patterns and tech bets are validated or invalidated? What's worth copying into the production stack? |
| **Customer success** | What new merchant conversations does this enable? What objections does it expose that we should be ready for? |

The artifact bundles three things that today's merchants assemble piecemeal across vendors — but the bundling is a *demonstration*, not a productization commitment:

1. **An AI composition engine** that reads shopper signals and generates page layouts in real time, surface by surface, with formal correctness guarantees.
2. **A complete ecommerce app foundation** — catalog, cart, checkout, account, search, locator — that exists whether or not the engine is personalizing it.
3. **A merchant control plane** (`aisles-admin`) that gives non-technical operators rule authoring, content authoring, A/B, and observability over the AI's behavior.

**Why an experiment, not a product?** The original v0.3 framing pre-committed to commercial pillars (market wedge, BC-native moat, competitive positioning vs. Bloomreach) and required ship-or-don't-ship decisions our teams haven't been asked to make yet. The experimental framing surfaces possibilities first; commitment comes from teams seeing the artifact, not from leadership reading a strategy doc. If the experiment succeeds, the question "should we productize any of this" becomes a real, evidence-backed conversation — not a speculative one.

### Mission

Make AI personalization invisible to the shopper and visible to the business user.

A shopper on an Aisles-powered storefront should never notice that the experience is personalized. They see a store that feels right for them — organized the way they browse, showing the depth of detail they care about, with the copy that speaks to their moment. The adaptation is silent.

The business user — a merchandiser, brand manager, or growth lead — sees exactly the opposite. The Observe dashboard shows every signal, every inference rule that fired, every probability shift, and every layout decision. They understand why the store is behaving the way it is, and they have controls to influence it.

This tension — invisible to the shopper, transparent to the operator — is the product's core design principle.

Transparency is only meaningful if the system's behavior is *explainable*, and explainability is only possible because the AI operates under a formal correctness invariant: every layout the AI produces must be an element of a finite, typed set of valid configurations defined in code. This invariant (`∀I, ∀P, f(I, P) → S ∈ V`) is what makes the Observe dashboard possible — you can surface "which component the AI chose and why" only if the components come from a known vocabulary. Without the vocabulary constraint, the system would be a black box even to its own operators. See `docs/architecture/decisions/004-vocabulary-constraint-invariant.md` for the full rationale and enforcement.

### Speed Over Accuracy: The Fail-Fast Principle

A slightly wrong layout served in 100ms is recoverable. A perfect layout served in 8 seconds is a bounce.

The inference engine is a continuous loop, not a one-shot decision. Every signal flush is a correction opportunity. Every refinement chat message is an explicit override. The gatherer-default cold start is a "safe wrong answer" that loads instantly and self-corrects as behavioral signals accumulate.

This principle governs trade-off decisions across the architecture:

- **Caching**: Serve stale-but-fast over fresh-but-slow. The Redis layout cache (1-hour TTL) means most visitors see a pre-generated layout, even if their persona has drifted since the layout was cached.
- **Streaming**: The SSE layout endpoint gets the editorial header visible in ~1 second before the grid is ready. Partial content beats waiting for complete content.
- **Data quality**: Enrichment quality is a background loop, not a rendering gate. Serve what you have. If enrichment data is missing or low-confidence for a product, commerce features silently degrade rather than blocking the layout.
- **Inference**: The base prior (`gatherer: 0.3`) ensures that even a session with zero signals gets a functional, exploration-friendly layout. The engine does not wait for behavioral signals before rendering — it renders immediately from request-time signals and refines as behavior accumulates.

The recoverable wrong answer is always preferable to the delayed right answer. The refinement chat, the continuous signal loop, and the session arc model (Phase 5) are all mechanisms for self-correction — they assume the first render was imperfect and provide pathways to improve it without the shopper ever noticing.

---

## 2. The three layers

```
┌───────────────────────────────────────────────────────────────────┐
│   3.3  AISLES-ADMIN (control plane)                               │
│        Merchant authoring · rule library · A/B · observability    │
│        (separate deployment, BC marketplace app — `aisles-admin`) │
└──────────┬──────────────────────────────────┬─────────────────────┘
           │ writes rules / content           │ reads telemetry
           ▼                                  ▲
┌───────────────────────────────────────────────────────────────────┐
│   3.1  AISLES ENGINE                                              │
│        Persona inference · signal pipeline · prompt construction  │
│        AI composition (per-surface, per-mode, per-state schemas)  │
│        Layout cache (Upstash) · enrichment store (Neon Postgres)  │
└──────────┬──────────────────────────────────┬─────────────────────┘
           │ composed layouts (JSON)          │ events / signals
           ▼                                  ▲
┌───────────────────────────────────────────────────────────────────┐
│   3.2  ECOMM APP FOUNDATION                                       │
│        Catalog (BigCommerce GraphQL) · Cart · Checkout · Account  │
│        Search · Locator · Static templates · Renderer             │
│              (SvelteKit + Vercel deployment)                      │
└───────────────────────────────────────────────────────────────────┘
```

| # | Layer | Owns | Composition latitude (per [composition taxonomy](../architecture/engine/composition-taxonomy.md)) |
|---|---|---|---|
| 3.1 | **Engine** | AI composition, persona inference, signal pipeline, prompt construction, schema validation, caching | Wide on Home/PLP, narrow on PDP, fixed on cart/checkout |
| 3.2 | **Foundation** | Routes, runtime state primitives (cart/checkout/account), static templates, search, locator, BC catalog adapter | None — foundation renders what the engine composes plus its own scaffolds |
| 3.3 | **Admin** | Rule authoring, content authoring, A/B, audience builder, observability, audit log | Authors the inputs the engine consumes; doesn't compose layouts itself |

**Why three layers, not one product:** conflating the layers is the project's known failure mode. Treating engine + foundation + admin as one undifferentiated stack produces (a) prompts that drift toward "compose everything" on every surface, (b) admin features that try to control composition output instead of composition inputs, and (c) foundation primitives that get re-implemented per surface because they were never named as their own layer. Naming the layers explicitly is what makes each independently shippable, separately priceable, and clearly bounded for the merchant.

For the per-layer architecture detail, see `docs/architecture/ARCHITECTURE.md` and `docs/architecture/{engine,foundation,admin}/`.

---

## 3. The three layers in detail

### 3.1 Engine — design philosophy

> _v0.2.0 vision content preserved verbatim below. This is the AI composition engine's design rationale, drawing on streaming/social-platform personalization research and the formal correctness invariant._



### 3.1.1 Products as Content: The Feed Model

A category page is a For You page. Products are the content tiles.

This is not an analogy — it is a structural claim about how the Aisles architecture works. The inference engine, the signal pipeline, and the persona-driven layout system implement the same mechanisms that streaming platforms use to curate personalized feeds. The difference is the domain (commerce instead of media) and the terminal action (checkout instead of continued engagement).

### The Structural Mapping

| Streaming Feed | Commerce Equivalent | Aisles Implementation |
|---|---|---|
| Video/song tile | Product card | `product-grid` items, `hero-product` |
| FYP algorithm | Inference engine + persona-fit sort | `infer()` + `loadCategoryProducts()` sort by persona-fit |
| Skip/swipe | Quick bounce (< 3s dwell) | `quick-bounce-pattern` rule, weight 0.6 |
| Full watch | Long dwell (15s+) | `long-product-dwell` rule, weight 0.6 |
| Save to playlist | Add to cart | `rapid-cart-adds` rule, weight 0.7 |
| Genre/mood filter | Category + refinement chat | Category routing + `refine.message` signal |
| Thumbnail A/B test | Persona-driven card presentation | Same product renders as hero (gatherer) or compact card (hunter) |
| "For You" row | Modular CLP sections | AI selects `editorial-header` vs. `category-header` based on persona |
| Autoplay next | Cross-sell suggestion | `cross-sell-strip` component (see `docs/functional/specs/intent-driven-commerce.md`) |

### Why This Framing Matters

**It changes what "browse" means.** In a traditional store, browsing is aimless navigation through a taxonomy. In a feed, browsing is a signal-rich activity where every pause, scroll, and skip updates the model. Aisles already treats browsing this way — `interact.scroll_depth`, `interact.dwell_time`, and `nav.back` are all engagement signals that streaming platforms pioneered.

**It reframes the cold-start problem.** A streaming feed with no history defaults to trending/popular content. Aisles defaults to the gatherer persona — the most exploration-friendly layout. Both are "safe wrong answers" that self-correct as signals accumulate. The fail-fast principle applies identically.

**It explains the component vocabulary.** The four layout components (`editorial-header`, `hero-product`, `product-grid`, `category-header`) are not page templates — they are feed section types. The AI acts as a feed algorithm, selecting which section types to display and in what order, just as TikTok's FYP selects which content format (short clip, live stream, carousel) to serve.

### The Critical Difference: Time-to-Decision, Not Time-on-Platform

Streaming feeds optimize for engagement — more time on platform equals more value. Commerce feeds must optimize for *time-to-confident-decision* — the shopper should reach a purchase decision or a deliberate exit as efficiently as possible.

This means the feed should behave differently by persona:

- **Hunter feed**: Collapses rapidly. Dense grid, minimal editorial, quick-add buttons. The feed should feel like it has 3-4 "right answers" and nothing else. Time-to-decision: seconds.
- **Gatherer feed**: Expands and breathes. Editorial headers, hero products, lifestyle imagery. The feed should feel infinite and browsable. Time-to-decision: minutes (or multiple sessions).
- **Researcher feed**: Deepens rather than widens. Spec tables, comparison blocks, detailed descriptions. The feed narrows to the products being evaluated. Time-to-decision: one focused session.
- **Gifter feed**: Curates to a safe middle. Universal-appeal products at accessible price points, gift framing copy. The feed should feel like a concierge selected 8-10 options. Time-to-decision: one session.

The layout engine already produces these patterns through persona-specific component selection and column density. The feed model makes the intent explicit: a hunter's page should feel *short*; a gatherer's page should feel *rich*.

### The Amazon Inspire Lesson: Don't Force Discovery on Utility

Amazon Inspire — a TikTok-style shopping feed launched in late 2022 — was shut down in early 2025. The failure is instructive because Amazon had every advantage (massive catalog, purchase data, scale) and still could not make the feed model work.

The root cause was **intent misalignment**: Amazon's core customer base arrives with a utilitarian, high-intent mindset. They want to find a specific item quickly, not scroll a video feed for entertainment. Bolting a discovery experience onto a utility-first platform created friction rather than removing it. Amazon subsequently redirected users toward Rufus, its conversational AI assistant — suggesting that for high-intent shoppers, agentic conversation outperforms visual feeds.

TikTok Shop succeeds where Inspire failed because commerce is parasitic on the entertainment experience. Users arrive to watch content; the commerce is incidental. The product wins on how compellingly a creator presents it, not on search relevance.

**What this means for Aisles**: The four-persona model is the architectural defense against the Inspire failure. A hunter should never receive a gatherer's discovery feed — that is literally the mistake Amazon made. The inference engine exists to detect intent and match it to the right feed format:

- **Gatherer** → discovery feed (editorial, expansive, exploratory). This is the persona where the "For You" model fully applies.
- **Hunter** → utility interface (dense grid, sort/filter, quick-add). This is a search-first experience that should feel like efficient retrieval, not media consumption.
- **Researcher** → comparison tool (spec tables, side-by-side, detailed descriptions). This is closer to a B2B procurement interface than a content feed.
- **Gifter** → curated selection (concierge-style, limited options, gift framing). This is a guided experience with intentional constraints.

The feed model is not universal. It applies fully to gatherers, partially to gifters, and barely at all to hunters and researchers. The inference engine's job is to detect which model the shopper needs and deliver it — not to default to discovery for everyone.

### Digital Pacing: Feed Length as a Persona Variable

Streaming platforms control engagement through pacing — the intentional design of content density and endpoint visibility to match the user's cognitive bandwidth. In commerce, pacing determines whether the feed feels infinite (gatherer) or finite (hunter).

The ASOS model demonstrates effective commerce pacing: 72 products per view with a "Load More" button rather than true infinite scroll. This provides continuity without the cognitive overload of an endless feed, and each batch gets a unique URL (solving the SEO problem of dynamic infinite scroll).

Aisles should implement persona-specific pacing:

| Persona | Feed Behavior | Product Count | Endpoint Signal |
|---|---|---|---|
| **Gatherer** | Continuous scroll with editorial breaks | 24+ products, load-more | "Keep exploring" — no hard end |
| **Hunter** | Dense grid with visible count | 8-12 products, all visible | "Showing 8 of 24" — progress indicator |
| **Researcher** | Paginated comparison view | 6-8 products per view | Page numbers — stable backtracking |
| **Gifter** | Curated finite set | 8-10 products, no load-more | "Our picks for you" — deliberate limit |

The key insight from cognitive load research: approximately 42% of users abandon purchases due to cognitive overload from dense, unstructured information streams. The hunter's dense grid avoids this by being *short* and focused. The gatherer's infinite scroll avoids it by being *paced* with editorial breaks that provide natural rest points — the digital equivalent of finishing an aisle in a physical store.

**Decision closure** is the mechanism: each persona needs a different "I'm done with this section" signal. Hunters need explicit progress ("3 of 12 viewed"). Gatherers need natural break points (editorial blocks between product rows). Researchers need page boundaries they can navigate back to. Gifters need the confidence that a small curated set is sufficient.

This is not yet implemented in the layout engine. The current `product-grid` component renders all products in a single block. Persona-specific pacing requires the layout prompt to control product count and endpoint behavior, and may require a new component (`load-more-trigger` or `pagination-bar`) in the vocabulary.

### Funnel Compression: Discovery as Transaction

Traditional marketing follows a linear path: awareness, consideration, conversion. Discovery commerce collapses these stages into a single interaction. A shopper discovers a product in their feed, consumes the associated content (editorial copy, specs, lifestyle imagery), and adds to cart — all within the same page view.

Aisles already implements funnel compression through the layout engine. A gatherer's `editorial-header` creates awareness; the `hero-product` drives consideration; the `product-grid` with quick-add enables conversion — all in a single scroll. The refinement chat compresses the funnel further: a shopper can discover, evaluate, and narrow their options through a multi-turn conversation without navigating to a separate search or filter interface.

The deeper implication is for **semantic enrichment**. If products are content in a discovery feed, they need "vibe-coded" attributes — not just technical specs. The enrichment pipeline's semantic tags (`"statement-piece"`, `"dorm-friendly"`, `"cozy"`) are the commerce equivalent of Netflix's mood tags. Whether a shopper searches for "puffy sleeves," "balloon sleeves," or "statement sleeves," enriched data should connect these varied expressions to the same product taxonomy.

The current enrichment pipeline produces semantic tags, but they are consumed only by the layout prompt (for copy generation) and persona-fit scoring. A future search implementation should use these tags for semantic matching — connecting natural language intent to products through meaning, not keywords.

### The Agentic Future: Beyond the Visual Feed

The visual feed may be a transitional form. Amazon's pivot from Inspire (visual feed) to Rufus (conversational AI) suggests that for high-intent shoppers, dialogue outperforms scrolling. Research indicates 58% of consumers now prefer AI assistants over search engines for product recommendations.

Aisles is positioned for this transition. The refinement chat is already an early-stage conversational agent that modifies the layout through natural-language constraints. The progression:

1. **Today**: Visual feed (persona-driven layout) + refinement chat (constraint stacking)
2. **Near-term**: Conversational discovery where the chat can proactively surface products, not just filter them
3. **Future**: The visual feed becomes a *rendering surface* for the conversational agent's selections — the shopper tells the agent what they need, and the feed reorganizes in response

The agentic orchestration layer is the durable differentiation; the visual feed is one rendering mode among several.

### The Creative Asset Challenge

If products are content, the brand needs enough creative variation to make each persona's feed feel authentic rather than mechanical. A single product photo shown to all four personas breaks the illusion. Streaming platforms solve this with thumbnail variants — Netflix serves different artwork per user segment for the same film.

The Aisles equivalent is persona-specific product presentation:

- **Today**: The AI writes different copy per persona (editorial for gatherer, spec-forward for researcher). Product images are static — the same photo appears in all layouts.
- **Future**: The enrichment pipeline could tag products with multiple image assets (lifestyle shot, detail shot, in-context shot, white-background shot). The layout engine selects the image variant that matches the persona: lifestyle for gatherer, detail for researcher, white-background for hunter.

This is not yet implemented but is the natural next step. Without image variation, the "feed" metaphor is half-realized — the structure adapts but the visual content does not.

---

### 3.1.2 What Streaming Platforms Teach Us

Aisles draws explicit inspiration from the personalization systems built by Netflix, Spotify, and Hulu. These are not analogies — they are the most rigorous deployed examples of behavioral personalization at scale. The signal expansion work (see `docs/architecture/engine/signals-and-inference.md` and `docs/functional/specs/behavioral-signals.md`) is directly motivated by what these platforms learned.

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

### 3.1.3 What Social Feed Platforms Teach Us

The streaming platform lessons above focus on content consumption — sessions measured in minutes, with a single content stream. Social feed platforms (TikTok, YouTube, Instagram) operate at a different timescale and interaction density. Their feeds process hundreds of micro-decisions per session, making them the closest deployed analogs to an e-commerce browsing session where a shopper scans dozens of product cards in rapid succession.

These platforms have transitioned from simple "systems of record" (showing what you follow) to "systems of intelligence" (anticipating what you want). They utilize a hyper-personalization stack that processes real-time behavioral signals to create a "segment of one" experience — the same architectural goal as Aisles.

### The Behavioral Skip Model (TikTok)

TikTok's "For You" Page (FYP) is the industry benchmark for behavioral modeling. It prioritizes what you actually do over what you say you like.

- **Negative signals as primary drivers.** TikTok treats a "skip" (swiping away in the first few seconds) as a much stronger signal than a full watch. This "skip model" allows the algorithm to quickly map the boundaries of your interests. The asymmetry is deliberate: rejections reveal preference boundaries faster than confirmations.
- **Continuous embeddings.** Instead of placing users in broad categories (e.g., "Gamer"), TikTok treats every user and every video as a vector in a high-dimensional mathematical space. Recommendation is nearest-neighbor lookup in that space.
- **Engagement loops.** The system uses continuous feedback to reinforce and refine your preference vector with every interaction, creating a loop of co-created value that tightens with each session.

**What this validates in Aisles**: The negative signal expansion (Phase 3 — `quick-bounce-pattern`, `cart-removal-indecision`) directly mirrors TikTok's skip model. The probability vector approach, where each shopper is a continuous distribution rather than a hard label, is the Aisles equivalent of TikTok's embedding space.

**What this challenges in Aisles**: See "Implementation Considerations" below — negative signal weight asymmetry and continuous vs. discrete persona modeling.

### Contextual Awareness and Serendipity (YouTube)

YouTube's feed focuses on the "moment" and deliberately breaking the filter bubble.

- **Contextual format modeling.** YouTube serves different content based on device and time of day. The algorithm predicts shorter, trending clips on a mobile phone late at night, but longer-form "deliberate" content on a TV during the weekend. Critically, this is not just a ranking change — it changes the *format* of the content served, not just the selection.
- **Serendipity by design.** To prevent the echo chamber effect, YouTube deliberately blends personalized picks with trending or exploratory content, encouraging discovery outside established patterns. This is an explicit implementation of the explore/exploit tradeoff.
- **Watch completion as intent proxy.** Similar to Netflix, YouTube prioritizes watch completion percentage as a key signal. Partial completion signals exploration; near-complete signals engagement.

**What this validates in Aisles**: The `mobile-evening-impulse` and `desktop-weekday-deliberate` rules implement contextual awareness. The `gatherer: 0.3` cold-start prior functions as a structural serendipity mechanism. Dwell time signals (`longDwellCount`, `quickBounceCount`) serve as watch-completion proxies.

**What this challenges in Aisles**: See "Implementation Considerations" below — device-aware format hints in layout generation.

### Modular UX and Attention Management (Instagram Reels)

Instagram Reels uses a modular, adaptive interface to manage the "attention economy."

- **Real-time signal ingestion.** The feed monitors clicks, scrolls, and dwell time through perceptive data pipelines, rearranging the content hierarchy in sub-second latency.
- **Modular component ranking.** The interface is not a fixed page but a collection of modular UI blocks. A ranking system determines which reels, ads, or suggested posts to display based on real-time intent.
- **Aesthetic vs. utility adaptation.** For discovery-based feeds, the system prioritizes high-aesthetic content (analogous to our gatherer persona) unless search history indicates specific product intent (analogous to hunter or researcher).

**What this validates in Aisles**: The layout engine's component vocabulary — where the AI selects from hero blocks, dense grids, spec tables, and editorial sections — is structurally identical to Instagram's modular block ranking. The emitter's 5-second flush cycle with immediate flush for high-priority events mirrors the real-time ingestion pipeline. The persona-driven aesthetic/utility axis (gatherer = editorial, hunter = dense grid) directly maps to Instagram's aesthetic vs. utility adaptation.

### Algorithmic Mechanisms Comparison

| Platform | Primary Signal | Core UX Objective | Strategy to Avoid Stagnation |
|---|---|---|---|
| **TikTok** | Swipes/Skips (Negative) | Intent Anticipation | Continuous Vector Shifts |
| **YouTube** | Watch Time & Context | Minimized Time to Value | Serendipity by Design |
| **Instagram** | Dwell Time & Interaction | Attention Management | Modular UX Adaptation |
| **Aisles** | Behavioral Signal Mix | Persona-Driven Layout | Gatherer-Biased Cold Start |

---

### 3.1.4 Implementation Considerations

The streaming and social feed platform analysis surfaces three areas where Aisles should evolve. These are not bugs — the current architecture supports all three changes — but they represent weight tuning, prompt enrichment, and philosophical decisions that should be made deliberately.

#### 3.1.4.1 Negative Signal Weight Asymmetry

**The pattern**: TikTok and Spotify both weight negative signals (skips, swipe-aways) more heavily than positive signals (watches, saves). The reasoning is that rejections reveal preference boundaries faster than confirmations. A user who listens to a full song may be passively tolerating it; a user who skips after 3 seconds is actively rejecting it.

**Current state**: In `src/lib/signals/inference.ts`, negative rules have the same or lower weight as their positive counterparts:

| Rule | Weight | Signal Type |
|---|---|---|
| `long-product-dwell` (positive) | 0.6 | Engagement confirmation |
| `quick-bounce-pattern` (negative) | 0.6 | Engagement rejection |
| `rapid-cart-adds` (positive) | 0.7 | Purchase intent |
| `cart-removal-indecision` (negative) | 0.7 | Purchase reconsideration |

**Consideration**: If the TikTok/Spotify model is correct, negative signals should outweigh their positive counterparts. A possible rebalance:

- `quick-bounce-pattern`: 0.6 → **0.8** (bouncing is a stronger signal than dwelling)
- `cart-removal-indecision`: 0.7 → **0.85** (removing from cart is more informative than adding)

**Risk**: Over-weighting negative signals can cause the persona to oscillate too quickly. A shopper who bounces off one product because they accidentally tapped it should not have their entire session recharacterized. The current `quickBounceCount >= 2` threshold mitigates this — the rule requires a *pattern* of bounces, not a single event — but the higher weight amplifies the effect when the threshold is met.

**Recommendation**: Test the asymmetry with a modest bump (0.7 for bounce, 0.8 for cart removal) before going to full TikTok-level asymmetry. Monitor the Observe dashboard's shift detection rate — if shifts increase by more than 30% after the weight change, the asymmetry is too aggressive.

#### 3.1.4.2 Device-Aware Format Hints in Layout Generation

**The pattern**: YouTube does not just change *which* content appears on different devices — it changes the *format*. Short-form clips on mobile at night; long-form documentaries on TV on weekends. The device context affects presentation structure, not just content ranking.

**Current state**: The `mobile-evening-impulse` and `desktop-weekday-deliberate` rules adjust persona weights based on device and time, but the layout prompt does not receive `deviceType` as a direct input. The AI infers format from the persona label alone. This means a hunter on mobile and a hunter on desktop get the same layout structure — the AI has no signal to prefer compact cards over wide spec tables.

**Proposed change**: Pass `deviceType` to `buildLayoutPrompt()` and add a format hint to the prompt template:

```
DEVICE CONTEXT: mobile
FORMAT GUIDANCE: Prefer vertically-stacked components. Use compact product cards
over wide spec tables. Limit editorial blocks to 2 sentences. Prioritize tap
targets over hover interactions.
```

```
DEVICE CONTEXT: desktop
FORMAT GUIDANCE: Use the full component vocabulary. Wide spec tables and
side-by-side comparisons are appropriate. Editorial blocks can be longer-form.
Grid layouts can use 3-4 columns.
```

**Where to change**: `src/lib/server/layout-prompt.ts` — add a `deviceType` parameter to `buildLayoutPrompt()` and a conditional format guidance block in the prompt template. No new signals, no new rules, no schema changes.

**Risk**: Low. The format hint is advisory — the AI can blend it with persona guidance. A researcher on mobile should still see specs, but in a vertically-stacked layout rather than a wide comparison table.

#### 3.1.4.3 Continuous vs. Discrete Persona Modeling

**The pattern**: TikTok does not use personas at all. Every user is a point in a continuous embedding space that drifts with each interaction. There are no "types" — only positions in a mathematical space.

**Current state**: Aisles uses four discrete persona labels (gatherer, hunter, researcher, gifter) with a continuous probability distribution over them. This is a hybrid approach — the probability vector provides continuity, but the final layout prompt still collapses to a `primary` label when confidence is high (>= 0.3). The Phase 4 blended layout work partially addresses this by passing probabilities to the prompt for low-confidence sessions.

**The tension**: Discrete personas are legible to business users. A merchandiser understands "this session is a hunter" far better than "this session is at position [0.12, 0.61, 0.22, 0.05] in persona space." The Observe dashboard, the admin layer, and the entire business-user experience depend on named personas.

**Recommendation**: Do not move to a fully continuous model. The four-persona framework is a product feature, not a technical limitation — it makes the system explainable to non-technical business users. Instead, continue deepening the probability vector's influence on layout generation:

- Phase 4 (already planned): Pass full probabilities to the prompt for low-confidence sessions.
- Future: Always pass probabilities, even in high-confidence sessions. Let the AI blend secondary persona elements (e.g., a strong hunter session with a 25%+ researcher score gets a specs section even in a hunter-first layout). The `primary` label remains the headline in Observe; the probability vector is the fine-grained control.

This preserves the business legibility of named personas while capturing the continuous-space benefits that TikTok demonstrates.

---

### 3.2 Foundation — design philosophy

The foundation is the table-stakes ecommerce app: catalog browsing, cart, checkout, account, search, locator, and the static templates the renderer composes from. **The foundation exists whether or not the engine is personalizing it.** A merchant who turns the engine off should still have a working storefront.

The foundation's responsibilities are defined by what every reference ecommerce platform ships out of the box (BigCommerce Stencil, Shopify Dawn, Magento Hyvä, commercetools Frontend, Saleor, Vue Storefront). Detailed competitive comparison is in [`docs/research/foundation/`](../research/foundation/) — the synthesis: there is a table-stakes minimum (8 canonical surfaces × ~15 universal sections) every credible ecomm site has. Aisles' foundation must hit that minimum, then differentiate by **how cleanly it integrates with the engine** — specifically, by exposing well-named insertion zones the engine composes into without the foundation having to know about persona inference or AI prompts.

**Design principles for the foundation:**

- **Engine-agnostic.** A foundation surface (PDP, cart, account) should be inspectable and shippable without the engine present. The engine is an optional input, not a hard dependency.
- **Surface-typed scaffolds.** Each surface has a fixed scaffold (PDP gallery / title / variants / ATC / description / reviews) plus named insertion zones. The engine fills the zones; the foundation owns the scaffold.
- **BC-native catalog adapter.** Catalog reads go through the BigCommerce GraphQL Storefront API. We do not maintain our own product DB.
- **Composition-aware static templates.** Templates that the engine never composes (cart line items, checkout step structure, account dashboard frame) are still parameterized — the engine can swap the upsell row contents in cart, choose the assurance copy variant in checkout, etc.

For per-surface foundation detail (which sections are mandatory, where the engine inserts, how cart/checkout/account flows work), see [`docs/architecture/foundation/`](../architecture/foundation/) (populates after PRD/BRD work).

---

### 3.3 Admin — design philosophy

The admin is the merchant control plane. It lives in a separate repository (`aisles-admin`) and deploys as a BigCommerce marketplace app embedded as an iframe in the BC admin panel. **The admin is the product's primary commercial surface.** The engine and the foundation are technology; the admin is what a merchant buys.

A merchant should be able to:

- **Author rules** that shape engine inputs (e.g., "always surface the BOPIS strip on PDP for shoppers in zip codes within 30 miles of a store").
- **Author content** that the engine composes into AI surfaces (e.g., a brand-spotlight block, a trend-shop card, an editorial-article teaser) and that the foundation renders on static surfaces (cart trust copy, account empty states).
- **Author audiences** distinct from the engine's persona inference (e.g., "first-time buyers from Florida who have not purchased in 90 days").
- **Run experiments** (A/B between engine compositions, rule variants, content variants).
- **Observe** what the engine is doing (cache hit rates, generation latency, persona distribution, rule firing frequency, AI decision explainability) and intervene when it drifts.
- **Audit** every change (who changed which rule when, with what justification).

**The explainability primacy.** The single most important admin capability is making the AI's behavior **explainable to non-technical merchants**. Why did the AI show this layout to this shopper? Which signals fired, which rules applied, which products got selected, and why? The composition engine's V invariant (every layout is an element of a finite typed schema) is what makes this explainability possible — you can surface "the AI chose component X because rule Y fired on signal Z" only when components come from a known vocabulary. Without explainability, the admin reduces to "trust the AI," which incumbent personalization vendors already offer and merchants already distrust.

Per the admin-layer competitive research, the field clusters into four archetypes — rule-builders (Dynamic Yield, Monetate), experiment-builders (Optimizely, VWO), CMS (Contentful, Sanity, Builder.io), and analytics (Mixpanel, Amplitude). No incumbent does all four well; merchants stitch. The **explainability gap is structurally favorable to Aisles**: Adobe Target Auto-Personalization, DY Predictive Targeting, and Monetate bandits are black boxes. The admin's daily-driver should be a **Decisions Inspector** ("what did the AI just do, and why?"), not a Rules tab. Rule authoring is secondary.

**Initial admin capabilities (already specified):**

- **Brand voice editor** — edit `voiceGuidance` without a code deploy.
- **Persona-fit overrides** — pin a product to a persona or suppress it from specific layouts.
- **Rule weight tuning** — increase or decrease the influence of specific inference rules per channel.
- **Cache invalidation** — force fresh layout generation for a category after merchandising changes.
- **Observe access** — view the real-time Observe dashboard from within the BC admin.

**V1 must include workspaces + role-based access control.** Bealls is a family of three brands plus an agency relationship — retrofitting permissions later costs roughly 10x. Adopt the Contentful role taxonomy (Admin / Developer / Editor / Author / Analyst) plus Adobe Target's Workspaces concept. Per-capability admin detail and the proposed path from current `aisles-admin` v0.1 stub to V1 lives in [`docs/research/admin/`](../research/admin/) and the spec at [`../functional/specs/aisles-admin.md`](../functional/specs/aisles-admin.md).

---

## 4. Cross-layer business user personas

These are the merchant-side personas the system serves. They cross all three layers — they observe engine behavior, configure admin rules, and rely on foundation primitives (catalog, cart, locator).

### 4.1 Merchandiser

Responsible for what appears on category pages and in what order. Pain: the default BC sort order is based on creation date or manual ranking. It does not adapt to shopper intent.

With Aisles, the merchandiser runs the enrichment pipeline after adding products. The enrichment scores each product on four persona-fit dimensions (gatherer, hunter, researcher, gifter) and tags it with semantic intent labels. The AI layout engine uses these scores to present high-fit products first. The merchandiser sees the scores in the Observe dashboard's product enrichment panel.

**Admin controls (target):** override persona-fit scores for specific products, pin items to specific positions within a persona layout, schedule rule changes, preview before publish.

### 4.2 Brand Manager

Responsible for voice, visual identity, and the narrative the store tells. Pain: AI-generated copy often sounds generic.

The brand config's `prompt.voiceGuidance` field feeds into every layout generation prompt. Bealls' voice instructs the model toward "off-price retail, family-friendly, comparable-value-first"; Bealls Florida's instructs "coastal lifestyle, sun-soaked, family"; Home Centric's instructs "in-store discovery, treasure-hunt, refreshed weekly." The brand manager owns these fields.

**Admin controls (target):** voice guidance editor, brand-block library (recurring promo modules), preview against live categories, side-by-side voice A/B.

### 4.3 Growth Lead

Responsible for acquisition and conversion. Pain: they can see UTM campaign performance in analytics but cannot see how incoming traffic intent maps to layout decisions.

The Observe dashboard exposes per-session signal attribution. A `utm_campaign=holiday-gift` tag on an inbound URL triggers the `utm-gift-campaign` inference rule, shifting the persona toward gifter, which produces a layout with editorial gift framing and curated price tiers. The growth lead can verify this chain without opening the codebase.

**Admin controls (target):** aggregate intent distributions per UTM source, campaign-bound rule variants, conversion attribution per layout composition.

---

## 5. Example merchant — Bealls

Bealls Inc. operates three retail brands (Bealls, Bealls Florida, Home Centric) on commerce.com. They are the example merchant for Aisles because their properties make every layer of the product visible and testable in a single engagement:

| Bealls property | Why it matters for Aisles |
|---|---|
| **Off-price retail with comparable-value pricing** | Hunter-persona dominant; pricing language is non-MSRP ("up to 70% off comparable value"); price-rail merchandising is critical |
| **Family of three brands sharing loyalty** | Cross-brand navigation, shared `Bealls Bucks` loyalty wallet, brand-strip nav as a foundation primitive — exercises multi-brand configuration |
| **BOPIS-heavy operationally** | `bopis-strip`, `bopis-picker`, store-locator integration are first-order requirements, not afterthoughts |
| **Bealls Bucks loyalty across all three brands** | Loyalty becomes a cross-brand engine input: "show Bucks balance pill in header, surface earn-preview on PDP, last-chance redemption in cart" |
| **Home Centric is content-only** | The storefront/content mode split is **real**, not synthetic. HC has no online catalog; its surfaces are editorial + locator. Forces the engine to support both modes from day one |
| **Real BigCommerce merchant** | The BC-native architecture (channels, GraphQL Storefront, marketplace app) maps to actual commerce.com infrastructure, not theoretical |

Bealls is not a one-off demo. The capabilities the engagement surfaces (multi-brand, BOPIS, loyalty, mode-aware composition, off-price pricing language) are general-purpose patterns our internal teams can extract — into roadmap, into the production stack, into merchant conversations. **The engagement is the artifact our teams react to. The capabilities are what they take away from it.**

For the engagement plan, deliverables, and current state, see [`docs/strategic/engagements/bealls.md`](engagements/bealls.md).

---

## 6. Reference brands

> **Historical note (v0.4.0):** This section reflects the upstream `aisles-storefront` repo's reference brands (Haven, Volt, Ember) — synthetic demos that proved the architecture was vertical-agnostic. The active Bealls fork uses the three real merchant banners introduced in §5 (bealls, Bealls Florida, Home Centric); the synthetic reference brands are not present in this codebase. The vertical-agnostic claim is preserved here because it explains why the engine was designed around a brand-config abstraction rather than hard-coded merchandising — that design property is what makes the Bealls family-of-brands setup possible.

The upstream Aisles prototype shipped with three additional reference brands (Haven, Volt, Ember) that proved the architecture is vertical-agnostic. The same inference rules, layout engine, and AI pipeline served furniture, electronics, and outdoor goods without modification.

| Brand | Domain | Positioning |
|---|---|---|
| **Haven** | DTC home furniture | Warm, editorial. Emphasized lifestyle storytelling and aesthetic discovery. |
| **Volt** | Consumer audio & electronics | Technical, spec-forward. Emphasized performance data and compatibility. |
| **Ember** | Outdoor lifestyle & fire | Rugged, seasonal. Emphasized activity fit and weather-appropriate bundling. |

The reference brands shared no product data, no BC channel, and no visual identity. They did share the inference engine, the layout component vocabulary, the enrichment pipeline, and the prompt construction logic. A brand is a configuration file — `src/lib/brand/config.ts` — not a fork.

This is the design property that the Bealls fork exercises against real merchant data: a merchant configures their brand in one file, no code changes required. The synthetic reference brands served as the original demonstrations of vertical-agnostic configurability; the Bealls family of three banners now serves the same function with real-merchant grounding.

---

## 7. What the competitive landscape teaches us

This section was previously framed as "competitive positioning" — what wedge Aisles owns against incumbents. Under the experimental framing, it is reframed as **what our internal teams learn from incumbents about the shape of the possibility space**. Detailed comparison across Dynamic Yield / Monetate / Bloomreach Discovery / Salesforce Personalization / Adobe Target / Algolia Recommend / Coveo / Klevu / Constructor.io is in [`STRATEGY.md`](STRATEGY.md) and [`../research/engine/`](../research/engine/). The headlines:

### vs. Amazon's "Frequently Bought Together"

Amazon's recommendation engine is statistical: items that appear together in purchase histories. The correlation is real but the reasoning is opaque. If no one has ever bought two items together, there is no signal.

Aisles uses **reasoning-based compatibility**. The enrichment pipeline uses Claude to evaluate each product against four persona archetypes, reasoning about material, use case, price tier, and aesthetic fit — not co-purchase frequency. A new product with zero sales history gets correct persona scores on day one. The distinction matters most for new brands and niche catalogs where statistical co-purchase data does not exist. This is exactly the BigCommerce merchant profile.

### vs. Rule-based personalization platforms (Nosto, Dynamic Yield, Monetate)

Existing personalization platforms for BC merchants are insertion-rule-based: "if the shopper is on mobile and in the furniture category, show the bestsellers widget." Rules require manual maintenance, do not compose well, and cannot produce layout-level changes (only widget-level injection).

Aisles infers intent continuously and uses that intent to drive **the entire layout** — the number of columns, the presence or absence of editorial copy, the sort order, the call-to-action pattern, the merchandising blocks. Layout-level personalization requires an AI that understands composition, not rules that swap products.

### What's surprising in the landscape

Three findings from the Stage 1 research that our teams should sit with:

1. **The "generative storefront" lane is empty.** Eleven of twelve surveyed personalization platforms top out at insert/rank/A-B between variants. **No incumbent generates whole ecomm surfaces as typed component trees.** Read this two ways: (a) a real possibility space nobody has occupied, or (b) a market signal that merchants don't want surprise layouts. The experiment exists to surface which read is correct — observable when teams + merchants react to the Bealls artifact.

2. **Incumbent AI investment has gone to feeding variant pipelines, not replacing them.** Adobe AI Assistant, Klaviyo K:AI, Optimizely Opal, Shopify Magic — all use AI to make humans faster at authoring variants. None generate variants directly. This is a **strategic stance**, not a capability gap. What our teams should ask: do our merchants want AI authoring, or do they want AI assistance? The artifact lets CS and product test this.

3. **Schema-typed + generated combination is structurally rare.** Constructor and Algolia type their data; Bloomreach types its CMS; Shopify types its admin via Polaris. None combine typed schema *composition output* with AI generation. The V invariant (`∀I, ∀P, f(I, P) → S ∈ V` — every layout is an element of a finite typed schema) is what makes generative composition shippable. Engineering teams reviewing the artifact should evaluate whether this pattern is worth adopting in production codebases regardless of whether Aisles itself is productized.

The biggest landscape risk to monitor (regardless of productization decisions): **Bloomreach**, whose Loomi + Clarity + Discovery + Content + Engagement stack and Elite BigCommerce partnership compress the possibility space if Clarity extends from chat turns to surface composition within the next 12 months.

---

## 8. Related documentation

**Within this canonical-state tree:**

- [`STRATEGY.md`](STRATEGY.md) — competitive positioning detail, scope boundaries, strategic risks
- [`risks.md`](risks.md) — load-bearing strategic bets and fallback paths
- [`engagements/bealls.md`](engagements/bealls.md) — Bealls engagement plan
- [`../functional/PRD.md`](../functional/PRD.md) — product requirements (populates after Task #44)
- [`../functional/BRD.md`](../functional/BRD.md) — user stories with trace IDs (populates after Task #44)
- [`../architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) — capability-level architecture

**Engine layer (§3.1):**

- [`../architecture/engine/composition-taxonomy.md`](../architecture/engine/composition-taxonomy.md) — block catalog × surface matrix × latitude rules
- [`../architecture/engine/signals-and-inference.md`](../architecture/engine/signals-and-inference.md) — signal types and inference rules
- [`../architecture/engine/fractal-interface-evaluation.md`](../architecture/engine/fractal-interface-evaluation.md) — composition philosophy
- [`../functional/specs/behavioral-signals.md`](../functional/specs/behavioral-signals.md) — signal expansion spec
- [`../research/engine/`](../research/engine/) — competitive research (Dynamic Yield, Monetate, Bloomreach, etc.)

**Foundation layer (§3.2):**

- [`../architecture/multi-brand.md`](../architecture/multi-brand.md) — brand configuration
- [`../research/foundation/`](../research/foundation/) — reference platform research (Stencil, Dawn, etc.)

**Admin layer (§3.3):**

- [`../functional/specs/aisles-admin.md`](../functional/specs/aisles-admin.md) — admin layer spec
- [`../architecture/observability.md`](../architecture/observability.md) — Observe dashboard
- [`../research/admin/`](../research/admin/) — merchant-control-plane research

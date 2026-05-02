# Aisles Demo — AI Champions Prep Sheet

**Audience**: Technical internal AI evangelists. They've built things with LLMs. They will push hardest on the parts of the demo that sound too clean.

**Companion doc**: `docs/strategic/demos/script.md` (the talk track). This doc is for Q&A and recovery.

> **Historical note (2026-05-02):** This prep sheet was authored against the upstream `aisles-storefront` demo flow (Haven / Volt / Ember). The active Bealls fork's demo reel v3 walks the same beats against bealls / Bealls Florida / Home Centric. The Q&A content below — model choice, schema enforcement, vendor risk, accessibility, prompt injection — is brand-agnostic and still applies verbatim. When running a Bealls-family demo live, swap the URLs (`aisles-demo-{1,2,3}-signal-x-studio-labs.vercel.app`), the brand names, and the voice-contrast example (use bealls' off-price comparable-value grammar vs. Bealls Florida's coastal lifestyle voice instead of the Haven/Volt furniture-vs-audio contrast).

---

## Pre-show checklist

- [ ] Storefront URL live and responding: `https://aisles-signal-x-studio-labs.vercel.app`
- [ ] Observe URL live: `https://aisles-signal-x-studio-labs.vercel.app/observe?key=aisles-observe`
- [ ] Volt live: `https://volt-aisles-signal-x-studio-labs.vercel.app`
- [ ] Ember live: `https://ember-aisles-signal-x-studio-labs.vercel.app`
- [ ] Incognito window open to Haven home (fresh session baseline)
- [ ] Observe window open, "Watch latest" checked
- [ ] Backup: `curl -X POST .../api/session/reset` verified working (hard reset if state gets weird mid-demo)
- [ ] Terminal in second screen with `src/lib/brand/config.ts` open to the Ember block (in case someone asks "show me the config")
- [ ] Video fallback ready: `scripts/demo-reel/out/demo-reel.mp4` (if live demo breaks, play this)

---

## Numbers to memorize

| Metric | Value | Source |
|---|---|---|
| Cost per refine generation | ~$0.006 | Observe panel, scene 8 |
| Cost per layout generation | ~$0.001–0.003 | Haiku 4.5, Anthropic pricing |
| Haiku 4.5 p50 generation | 2–4 seconds | Your own telemetry |
| Full demo session cost | < $0.02 | Observe cumulative |
| Brand config line count | ~150 lines per brand | `src/lib/brand/config.ts` |
| Production cache hit rate (projected) | 80%+ category, 0% refine | Aspirational, say so |
| Current personas | 4 (gatherer, hunter, researcher, gifter) | |
| Inference rules active | 27 | `docs/architecture/engine/signals-and-inference.md` |

**If you forget the cost numbers**, say *"under a penny per generation, fractions of a cent on cache hits."*

---

## Demo flow — 30-second reminders per step

Full version in `docs/strategic/demos/script.md`. This is the "don't forget to say" list.

**Step 1 — Haven home**. Point to the editorial header. *"This was written by an AI, not a copywriter."* Don't skip the hero product placement.

**Step 2 — Observe baseline**. Point to the persona vector. *"Gatherer 38%, no rules fired — this is the prior."* Mention `signalCount` is 2 or 3, only request-time signals.

**Step 3 — Search "dorm room desk"**. The line is *"Watch what happens."* Pause on the new layout so the audience can see it shift before you switch to Observe.

**Step 4 — Observe shift**. Point to **Rules Fired**. Say *"hunter-keyword fired on 'dorm' and 'desk'"* and *"price-sensitivity pushed to 45%."* Name the specific rules. That's what makes this read as empirical and not hand-wavy.

**Step 5 — Volt**. The line is *"same codebase, same inference engine, same AI."* Point to the spec-first copy ("40mm drivers" vs. Haven's "pieces that hold up to real life"). That contrast lands harder than saying "different brand."

**Step 6 — Ember**. Keep this short. 60 seconds max. The payoff is scene 7.

**Step 7 — Ember config**. If you can live-scroll through `src/lib/brand/config.ts`, do it. Point at `voiceGuidance` and `personaDefinitions`. *"These strings are why the copy reads the way it does."*

**Step 8 — Refinement chat**. Demonstrate constraint stacking. Say *"each message compounds, it doesn't replace."* Then switch to Observe and point at `type: refine` — that's the money shot for the cost-tracking close.

**Step 9 — Cost close**. The line is *"less than two cents for that entire session."* Don't round up. Numbers carry more weight than adjectives.

---

## Q&A — likely questions by category

### Architecture & model choice

**"What model, why Haiku, and what's cached?"**
Haiku 4.5 primary for layout and refine, Sonnet 4.6 as a **failure fallback via Vercel AI Gateway** — if Haiku errors (rate limit, 5xx, timeout), the gateway retries on Sonnet automatically. It is a reliability fallback, not a quality fallback. Both models target the same schema.
Validation is **Zod-driven structured output via Vercel AI SDK** (`Output.object({ schema: LayoutSchema })`). The schema enforces: discriminated union on component type (only four component values allowed — editorial-header, hero-product, product-grid, category-header), sections array bounded 1–8, enum constraints on persona, column count, image ratio. Schema failures retry inside a single AI SDK call.
Haiku because layout isn't a reasoning task — it's structured output against a constrained vocabulary at ~2–4 second p50. Anthropic prompt caching on the stable prefix: brand config, rules context, product summaries. The varying suffix is request-time signals.
*Landmine*: don't claim Claude is "better at commerce." Say "Haiku hits the latency and cost envelope. Sonnet is there when Haiku's infrastructure drops requests, not when Haiku's output is low-quality."
*Follow-up you should expect*: **"What if Haiku returns schema-valid but low-quality output — say, only two products when the grid should have twelve?"** Honest answer: nothing routes that to Sonnet today. The schema doesn't enforce a minimum on `productOrder.length`. That's a quality-fallback loop you haven't built yet. Say so.

**"Cache key, and real hit rate in production?"**
Key is roughly `persona + categorySlug + promptVersion`. Refinements are cache-varied by constraint hash, so they always miss. Projected hit rate 80%+ on category pages, 0% on refinements. Be explicit that current demo numbers are unrepresentative.

**"Cold start on a new category?"**
2–8 seconds first hit, cached thereafter. The streaming endpoint (`/api/layout/stream`) sends partial layout JSON as it generates — editorial header renders in ~1 second, grid catches up. Bring this up even if nobody asks.

**"Are you using agents, or is this single-shot generation?"**
Single-shot structured output with vocabulary constraints. No agent loop. No tools. One call per layout, one call per refinement. Deliberately simple. Agents would add latency and spend without a demonstrated quality gain for this task.

### Quality, evaluation, and failure

**"How do you know the AI's choices are any good?"**
Today: schema validation (can't emit invalid JSON or out-of-vocab values). Not yet: an outcomes loop that ties `cart_add` and `purchase` events back to the generation that produced them. Say this plainly. *"We validate structure. We have not yet validated outcomes. The outcomes table is the next build."*
*Landmine*: if you bluff this, someone will ask for numbers.

**"What happens when generation is bad — wrong price, hallucinated spec?"**
Price, inventory, and specs are server-assembled in `loadCategoryProducts`. The AI never sees the live price stream; it emits product IDs, and the server fills in the canonical data. Hallucinated *copy* is the real risk — the brand voice guidance in config is the mitigation, plus a copy-eval pass before serving. Be honest: the eval pass exists for layout structure but not yet for copy semantics.

**"Prompt injection. The search query goes into a prompt, right?"**
Yes, but indirectly. The search query goes into the *inference* pipeline as a classified signal, not into the layout prompt as free text. The layout prompt context is structured and fixed. The vocabulary constraint (ADR-004) means the model can only emit tokens from a fixed enumerated set — section types, product IDs from the server-provided list, layout primitives. A prompt injection that said "IGNORE PRIOR INSTRUCTIONS" physically cannot produce valid layout JSON that serves malicious content.
*Follow-up to expect*: "have you red-teamed this?" Answer: "structurally sound, not yet adversarially tested." Say it first so nobody catches you.

**"Inventory goes to zero mid-session. What happens?"**
The layout references product IDs. If an ID is missing when the server assembles data, it's dropped from the render. You don't regenerate — you render the remaining products in the layout's declared order. Degraded, not broken.

### The moat question (rehearse this one)

**"Anyone with an API key can do this. What's defensible?"**
Three parts:
1. The inference rule set and persona definitions are empirical domain knowledge. Getting "dorm+desk → hunter" to fire correctly without over-triggering took iteration.
2. The enrichment pipeline and vocabulary-constrained schema. Nobody rebuilds these from scratch — they'd have to replicate months of data work.
3. The feed model bet: configuration-as-content scales where hand-built templates don't. Anyone can run Claude, but reaching this output quality consistently is a data problem, not a model problem.

Don't claim the moat is the AI. It isn't. The moat is the system around the AI.
*Landmine*: if you describe this as "better prompts," you lose the technical audience.

### Integration with existing stacks

**"How does this coexist with Adobe Target / Dynamic Yield / Bloomreach?"**
Merchandiser overrides sit above the layout generation as priority. "If Target says pin product X to slot 1, the AI generates around that pin." If this wiring doesn't exist yet, say so and say the schema supports it.

**"SEO. Does Google crawl AI-generated layouts?"**
Yes. Server-side rendering. First visit to any URL generates at request time, the HTML is fully rendered server-side, cache ensures crawlers hit the same content on repeat visits. The SEO risk would be *different* H1s on every crawl — the cache prevents that. Stable H1s per (persona, category) pair.

**"Accessibility. Who signs off on generated HTML?"**
The component library is hand-authored with a11y baked in. The AI only composes from that component vocabulary. It physically cannot produce an unlabeled button or an image without alt text — those fields are required by the schema and components fill them from structured data.
*This is your best answer to "generated HTML is dangerous."* Lead with it.

**"Can you run this on-prem or with an open model?"**
Architecturally yes, using Vercel AI SDK's provider abstraction. Not tested. A real swap would need re-tuning prompts and re-validating the vocabulary constraint against the new model's tokenizer. Don't oversell this.

### Personas, data, and config

**"Four personas. Where did they come from? Any evidence they're real?"**
Academic buying-mode taxonomy — inspirational vs. task-directed vs. comparison vs. gift — mapped to your four. *No* empirical validation on Aisles traffic yet. Frame as a starting taxonomy refined from conversion data once the outcomes loop is wired. Be honest.

**"What's in the brand config? Really 150 lines?"**
Yes. Channel ID, category map, theme tokens, persona definitions, voice guidance, domain description. The persona definitions and voice guidance are the non-obvious parts. Walk through the Volt "researcher compares LDAC vs. aptX" string — that specific string is why Volt copy reads like an audio brand.

**"Who writes these configs?"**
Aspiration: product with engineering review. Reality today: you write them. Say so.

**"What's the enrichment pipeline? When is it run?"**
Batch job per brand, hits each product and extracts: persona fit scores across the four personas, semantic tags, category fit, style descriptors. Stored in Supabase, keyed by BigCommerce entityId. Re-run on catalog updates. The AI at request time reads enrichment, not raw product data.

### Vendor risk

**"Anthropic raises prices or deprecates Haiku — then what?"**
Layout schema and inference engine are provider-agnostic. Generation wraps Vercel AI SDK's `generateText`. Swap the provider flag, re-tune the prompt, re-validate vocabulary constraints on the new model. The porting cost is real but bounded. Weeks, not a rewrite.

**"Can you self-host?"**
Not today. Would need a model that does structured output well enough to honor the vocabulary constraint. Llama 3.3 70B might be close. Haven't tested.

### Commercial & legal

**"Who owns the AI-generated copy? Anthropic, you, the brand?"**
Per Anthropic's terms, the output belongs to the customer (you / your brand). Keep the receipts: brand config, generation logs, prompt version. All auditable.

**"What about regulated verticals — pharma, finance?"**
Not tested. The architectural answer: the vocabulary constraint becomes a compliance constraint. If a regulator requires certain disclaimers on every product card, they go in the component, not in the AI output. The AI can't *not* emit them. Again: the moat is the system around the AI.

**"Brand safety. Can brand A's data leak into brand B?"**
Separate deployments, separate Redis namespaces, separate Supabase tables keyed by brand flag. No shared state at request time. The AI call is stateless and scoped to a single brand's context.

---

## Things to preempt (bring up before someone asks)

1. **"This is a demo, not production traffic."** Say it first. It defuses the "but will it scale" question before it's asked.
2. **"The outcomes loop isn't wired yet."** Mentioning it yourself signals you know what's missing. Getting caught hiding it is worse.
3. **"We haven't adversarially tested prompt injection."** The vocab constraint is structurally sound. You haven't red-teamed it. Say so.
4. **"The persona taxonomy isn't validated on Aisles traffic."** Academic basis, not empirical. The outcomes loop will fix this.

---

## Things NOT to say

- "This replaces your merchandising team." (It doesn't. It's the default when merchandisers are absent.)
- "It costs nothing." (It costs less than they'd think. Don't say "nothing.")
- "The AI decides everything." (Schema + vocabulary + server-assembled data decide most things. The AI fills within rails.)
- "This is AI-first." (It's AI-native, which is a more defensible claim. "AI-first" sounds like a slogan.)
- "We're building our own model." (If asked about fine-tuning, say: "We haven't needed to. The prompt + enrichment + config performs well enough that fine-tuning would be optimizing the wrong axis.")
- "Haiku is the best model." (Say "Haiku is the right model for this task at this price point." Leave room for it to change.)

---

## Recovery lines (when a demo step breaks)

- **Page won't load / 500 error**: "Let me show you the Observe panel while that refreshes — here's where we catch these in real time." Pivot to telemetry.
- **Observe shows no new signals after search**: "The signal pipeline has ~1-second propagation. Let me narrate what you'd see." Show the rule definitions in `src/lib/signals/rules.ts`.
- **Refinement chat times out**: "This is why the streaming endpoint matters — on a cold generation, constraints always miss cache." Then open `src/routes/api/refine/+server.ts` if someone wants to see the prompt.
- **Persona doesn't shift as expected**: "This is the cookie state from the previous demo — let me reset the session." Hit `/api/session/reset` in a new tab.
- **Everything's on fire**: "Let me play the demo reel instead." Open `scripts/demo-reel/out/demo-reel.mp4` full-screen. The reel covers the entire talk track in 5:28.

---

## Questions to ask the audience (if discussion slows)

- *"Where in your stack would you plug this in — at the template layer or at the CMS layer?"*
- *"What signals do you capture today that we aren't using?"*
- *"If you could pick one vertical to try this in, which one and why?"*

These pivot the conversation from "defend the demo" to "let's design for your constraints" — the best outcome of any champions session.

---

## One-line elevator pitches (pick the right one for the moment)

- **Technical**: "Structured-output LLM generation against a vocabulary-constrained schema, fed by inference rules and product enrichment, cached on persona+category."
- **Business**: "Every storefront rewrites itself for who's visiting, at fractions of a cent per page, with no per-brand UI code."
- **Skeptical**: "It's not AI writing HTML. It's AI choosing from a fixed menu the server already approved."
- **Sales-y**: Don't. This is the wrong audience. Go technical.

---

**Last thing**: if a question catches you off guard and you don't have an answer, say *"I don't know — let me come back to you."* AI champions respect that answer a lot more than they respect bluffing. Write down the question, follow up in Slack.

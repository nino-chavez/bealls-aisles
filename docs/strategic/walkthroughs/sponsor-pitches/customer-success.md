## Sponsor pitch — Customer Success

**Audience:** customer success team sponsor (CS lead, head of solutions, or SE who can host one merchant or stand-in audience for 25 minutes)
**Asks for:** 25 minutes + a verbatim merchant transcript
**Layer(s) demonstrated:** engine + foundation (signal / inference trace via `/observe`; rescue surfaces via FND-012)
**Anchored on:** [STORY-012](../STORY-012-merchant-explainability-demand.md) (merchant explainability demand)

### 30-second elevator

Adobe Target, Dynamic Yield, and Monetate are black boxes. When a merchant asks "why did the AI do this?", today's incumbents punt — Sanity's Content Source Maps and Constructor's MIA are the only competitors flirting with explainability, and both are thin. We have a working artifact that surfaces the full trace — signals, rules fired, persona, model, layout, cost — for any composition the AI made. The question we want CS to test in 25 minutes with one merchant: **does explainability close the deal, is it nice-to-have, or do merchants actually want override controls instead?** The answer reshapes how we talk to merchants about AI across our entire product line, not just Aisles.

### 25-minute agenda

| Minutes | Activity | Reference |
|---|---|---|
| 0–3 | Frame the experiment to the merchant. *This is an artifact our team built to learn what merchants want from AI personalization. Not a sales meeting. Your reactions are the artifact.* | [NORTH-STAR §1](../../NORTH-STAR.md), [STRATEGY §2.3](../../STRATEGY.md) |
| 3–7 | STORY-012 demo path steps 1–2. Cold homepage on demo-1, then `?intent=hunter`. **Ask: "what changed and why do you think it changed?"** Capture verbatim. | [STORY-012 demo](../STORY-012-merchant-explainability-demand.md#demo-path) |
| 7–14 | STORY-012 steps 3–4. Open `/observe`. Walk the trace top-to-bottom. **Caveat the merchant immediately:** "this is the engineer's view of what just happened — the merchant view ships in Phase 4. The data underneath is the same." Capture body language. | STORY-012 steps 3–4 |
| 14–19 | **NEW (FND-012 ship — 2026-04-30):** drive the merchant to a search rescue. `/search?q=zzzqqxxx` — empty rescue renders with brand voice ("Let's explore something new together"), curated alt-paths, persona-aware product carousel. Ask: "what does it mean to you that an empty search recovers like this?" Empty-cart and empty-wishlist are equivalent demo paths if the merchant's instinct points there. | [PRD-FND-012](../../../functional/PRD.md), [`src/lib/components/EmptyRescue.svelte`](../../../../src/lib/components/EmptyRescue.svelte) |
| 19–22 | STORY-012 steps 5–6. If a competitive tool (DY/Monetate/Adobe Target) is referenceable in conversation, ask: "where in your current tool can you see why the AI did this?" Then the closing question: "would you use this — in a friendly merchant UI — weekly, monthly, never? Which surface? Which question?" | STORY-012 steps 5–6 |
| 22–25 | Capture verbatim. Decision-matrix entry, first-3-sentences-of-reaction, 5 actual phrases the merchant used. **No paraphrasing.** | [STORY-012 bring-back template](../STORY-012-merchant-explainability-demand.md#what-to-bring-back-the-audience-fills-this-in--verbatim) |

### Why empty-rescue is a strong CS moment (FND-012 just shipped)

Search-zero-results is the moment where most storefronts go quiet. *"We didn't find anything."* The artifact does the opposite — empty-search rescue renders a brand-voiced editorial header, alt-path carousels, curated category pivots, and persona-aware product picks. It works for empty-cart, empty-wishlist, and 404 too. **Three reasons this matters in a merchant conversation:**

1. **It's the most relatable demo path** — every merchant has an empty-search problem. Personalization on the home page is abstract; rescue from a dead end is felt.
2. **It demonstrates that AI composition isn't just "personalize the happy path"** — it composes the unhappy path too, in brand voice. That's a structurally different claim from incumbents.
3. **It surfaces the explainability question naturally.** When the merchant sees a rescue layout they wouldn't have approved manually, they ask "why did it pick that?" — which is exactly the conversation STORY-012 exists to test.

### What you'll bring back

Verbatim from STORY-012 (full template in the walk-through doc):

- **Verbatim merchant reaction to the trace** — first 3 sentences they spoke, no paraphrasing.
- **The first follow-up question.** Was it about a signal? A rule? The persona model? The layout? Or about who can change this / when / who can see it?
- **5 actual phrases the merchant used.** Their language, not ours.
- **Did the merchant want explainability *primarily*, control *primarily*, or both?** With evidence.
- **Comparison with their current tool** — verbatim quote on whether they can answer "why" today.
- **Decision-matrix entry** — explainability closes / nice-to-have / developer-feature / actually-they-want-control.

### Bealls touchpoints — what Bealls specifically demonstrates

- **BOPIS in product UX.** Pickup availability surfaces at the product card and PDP level, not just at checkout. Useful for any merchant conversation about omnichannel — "does the storefront make the store visible?"
- **Off-price language survives AI generation.** "Comparable value, up to 70% off", "Bealls Bucks", "shop smart, save big" — the brand voice holds across all four personas and all rescue surfaces. Counter to the merchant fear that "AI will sound generic." Bring this up if a merchant flinches at the AI authoring story.
- **Family-of-brands as one engagement.** Bealls + Bealls Florida + Home Centric live on three Vercel deployments off one codebase. Useful for any merchant conversation involving multi-banner / multi-region / agency-managed catalog operations.
- **Content-mode brand (Home Centric).** No products, no cart — locator + brand-pillar storytelling only. Useful for any merchant conversation involving brands that don't sell online but still want personalized digital experiences. Often surfaces in CPG / wholesale / B2B-adjacent conversations where merchants assume "personalization needs ecommerce."
- **Empty-rescue as a Bealls-shaped demo.** "Sorry, we didn't find that" doesn't fit Bealls' off-price voice — the rescue is voiced as "Let's explore something new together" with curated picks. Demonstrates that brand voice is enforced at composition time, not bolted on.

### What success looks like for this run

- **One verbatim transcript on file.** Verbatim, not summarized. Empty merchant quotes = the walk-through is the wrong shape; revisit before running again.
- **A decision-matrix entry the artifact didn't pre-decide for the merchant.** If every CS run produces "explainability closes the deal," that's a confirmation-bias signal — the question wasn't asked honestly.
- **Cross-merchant pattern after 3 runs.** STORY-012 host-notes call this out: after 3 merchant runs, look for whether merchants are asking "why" or "can I". That distinction informs whether Phase 4 builds Inspector-first or Override-first. Don't synthesize the pattern from 1 run; that's where vanity-demo signal lives.

## STORY-001 run — 2026-04-30, Nino as PM-audience

**Walk-through doc:** [`../STORY-001-persona-model-fit.md`](../STORY-001-persona-model-fit.md)
**Run conditions:** Bealls demo-1, headless Chromium via Playwright (proxy for "live PM viewing in browser"), ~12s wait after each navigation to allow the streaming layout to settle.
**Caveat:** I (Nino) authored the walk-through and am also the PM-role audience. This is structurally weak — the bring-back below is more "did the walk-through structure hold up" than "did a PM extract value cold." Treat as a structural pilot, not as evidence of audience extraction. The next run must be cold (a real PM, ideally without prior context).

### Verbatim observations per intent

**Hunter (`?intent=hunter`)**
- Editorial header: "Up to 70% off thousands of items" — deal-forward, non-MSRP voice held.
- 4-column dense grid, 15 product cards visible.
- ATC ("ADD TO CART") button on every card — quick-add affordance.
- Editorial blocks: "Best Sellers" rail; "Under $10 / Under $15 / Under $20" price-tier tiles.
- Hero CTAs: WOMEN (primary) + MEN / KIDS / SHOES (secondary).
- Time-to-decision: short. Visible price first, ATC second.

**Gatherer (`?intent=gatherer`)**
- Editorial header: "Discover Your Wardrobe Essentials" — lifestyle voice.
- Header copy verbatim: "From vibrant prints to timeless stripes, our curated selection of women's tops brings style and value together. Each piece tells a story—find the ones that speak to you."
- Asymmetric layout: large hero product card with descriptive copy → 2-up rows.
- 12 product cards (fewer than hunter), larger card sizes.
- "Complete the Look" recommendation rail.
- No quick-add visible on cards — click-into-PDP behavior.
- **Friction:** several product images returned gray placeholders even after stream completion. CDN or product-image data issue, not AI; but it distracts visibly from the layout-fidelity story for any audience.

**Researcher (`?intent=researcher`)**
- Editorial header: "Shop Smart. Save Big. Family Quality, Comparable Values Up to 70% Off." — verbose, comparison-framed.
- Header copy: "Whether you're looking for everyday essentials or special finds, we've got the details to help you decide. Compare specs, read reviews, and find exactly what works for your family—at prices that make sense."
- 4-column grid, 15 products. No ATC on cards (evaluate-before-action).
- Bealls Bucks "Earn $5 / for every $50 you spend" call-out — value-conscious comparison shopper.
- **Friction:** same image-skeleton issue on later cards.

**Gifter (`?intent=gifter`)**
- Editorial header: "Find the Perfect Women's Top for Any Occasion" — explicit occasion framing.
- Header copy: "Each pick is chosen for quality and giftability—so you can feel confident giving it."
- Featured product: lace + rhinestone tank — "statement piece" aesthetic.
- Promo banner: "Starting at just $9.99" + "Up to 70% off comparable value — gifts that feel special at prices that feel right".
- "Customer Favorites" rail (concierge / trusted picks framing).
- 13 product cards, "Quick view" CTA on cards (peek without commit).
- GIFT code promo block.

### What the walk-through structurally produced

- The four personas are genuinely distinguishable on the same Bealls catalog. Composition latitude is visible in: (a) editorial-header copy/voice, (b) grid density/columns, (c) presence/absence of ATC quick-add, (d) presence/absence of price-tier blocks, (e) recommendation rail framing ("Best Sellers" vs. "Complete the Look" vs. "Customer Favorites"), (f) curated-set size.
- The off-price voice (comparable-value language) holds across all four personas — Bealls voice survives persona variation. Useful evidence for STORY-019.
- Latency: cold first-gen ~10s per persona (acceptable for a walk-through; concerning for a real shopper unless cache hit rate is high).
- Researcher persona produced the verbose-comparison voice but did NOT produce a spec table or comparison block — the "spec-forward" claim in PRD-ENG-009 acceptance was understated. The persona changes copy density and framing more than it changes structural blocks.

### Filled bring-back template

```
Run date: 2026-04-30
Audience role: PM-role (self, walk-through author — not a cold PM)

Persona model adoption recommendation:
☑ Adopt with modification

Modification:
The 4-persona model produces real, observable layout differentiation — but more
strongly via copy/voice than via structural blocks. For our roadmap, separate
two questions: (a) "should AI vary copy by inferred intent?" — yes, with high
confidence based on this artifact; (b) "should AI vary structural composition
by inferred intent?" — yes for hunter (price-rail tiles) and gifter (curated
concierge-style sets); weaker evidence for gatherer (mostly sizing) and
researcher (mostly copy density). The right roadmap shape is "personas drive
copy strongly + structural blocks where the persona has a distinctive primitive
(price-rail for hunter, curated-set for gifter) — and don't force structural
distinctiveness for the others when copy carries the load."

Reasoning bound to observed merchant scenarios:
A merchandiser at an off-price retailer (Bealls) would value the price-rail
tiles for hunter and the curated-gift-set for gifter — both map to in-store
merchandising primitives they already use. They wouldn't necessarily ask for
researcher-specific structural blocks; the verbose comparison voice probably
carries the weight a PDP spec table would.

Block / surface / latitude observations that surprised me:
- Gifter editorial language ("giftability", "feel confident giving it",
  "feel special at prices that feel right") was specific enough that the
  brand voice + persona + Bealls voiceGuidance produced something I'd
  let ship. That surprised me — I expected generic AI gift copy.
- The Bealls voice ("comparable-value, up to 70% off") survived all four
  personas. The persona model didn't override the brand voice; it modulated
  inside it. Important for the explainability story.
- Researcher persona did not produce a spec/comparison block — only verbose
  copy. The PRD-ENG-009 acceptance criterion overstates what the artifact
  does today.

Capabilities I want to extract into our roadmap regardless of persona-model decision:
1. Editorial-header generation that holds brand voice while modulating to
   inferred intent. This is independent of "do we use 4 personas" and worth
   adopting for any AI copy surface in our product line.
2. The price-tier tile primitive (Under $10/$15/$20) for off-price merchants.
   This is a merchandising block worth standalone — even non-AI sites should
   ship it.
3. The curated-set / concierge-rail primitive ("Customer Favorites",
   "Complete the Look") with persona-aware framing copy.
4. The LayoutBuildingState pattern — graceful "AI is composing your view"
   loading state, not a generic spinner. Useful even if we adopt none of the
   AI composition.

Things the artifact got wrong that would block adoption with our merchants:
- Product images intermittently fail to load on gatherer/researcher pages.
  Distracts in any walk-through and would block any merchant demo. Not the
  AI's fault but lives at the same surface — needs fixing or worked around.
- The "Researcher" persona doesn't produce structurally researcher-shaped
  output; copy carries the load. Defensible as a design choice, but only if
  we can articulate it. Today, the PRD/BRD copy oversells what's there.
- 10s cold-start latency is borderline for a walk-through audience and over
  the line for a real shopper if cache hit rate is below the 80% RISK-01
  trigger.
- /observe is gated by a key in production — the walk-through doc references
  it as a live diagnostic but doesn't include the key step. Breaks the demo
  flow until fixed.
```

### Walk-through structural assessment (host's perspective)

- Demo-path table of 6 steps was the right shape — concrete enough to follow without supervision, short enough to hold attention.
- Wait-for-stream timing (~10s per persona) means the walk-through eats 60–90s on layout transitions alone. For a real PM session, pre-warm the cache on each persona before starting.
- The bring-back template **did** force a real recommendation. Empty fields would have been visible — that's the test of the structure working.
- The Observe-tab portion failed because of the key prompt. The walk-through doc must add a "host obtains observe key from project lead before session" prereq, OR replace the Observe tab with a static screenshot or a developer-mode bypass. Either way, the doc is wrong as written and produced friction in this run.
- The walk-through does NOT yet ask about merchant-team operability — only PM-team adoption. That's a gap; STORY-001 binds to product but the recommendation a PM brings back has implicit merchant-operability assumptions. Consider adding one closing question.

### Concrete documentation fixes for STORY-001 walk-through doc

1. Add prereq: "Obtain `OBSERVE_KEY` from project lead before running."
2. Add prereq: "Pre-warm cache for all 4 intents before audience arrives — first-gen latency is 5–10s and breaks the rhythm of the walk-through."
3. Soften the PRD-ENG-009 expectation in the "what to observe" section: the persona drives **copy + curation more than structure**. Don't ask the audience to look for spec tables (researcher) or rich layouts (gatherer); ask them to look for distinctive copy + distinctive merchandising primitives where they exist.
4. Add closing question: "If our merchants ran this, what would block them from operating it daily?"

## STORY-001 walk-through — Persona model fit

**Audience:** product
**Hypothesis tested:** H1 (schema-typed generative composition is production-viable)
**Layer(s) exercised:** engine
**Trace IDs:** PRD-ENG-002, PRD-ENG-008, PRD-ENG-009
**Time budget:** 25–30 min (walk-through + bring-back capture)
**Prereqs:**
- Browser, two tabs (storefront + Observe).
- **Host pre-warms cache before audience arrives.** Cold first-gen is 5–10s per persona; without warming, the walk-through eats 60–90s in dead air during transitions. Hit each of the four `?intent=` URLs once before the session.
- **Host has the Observe key.** `/observe` is gated in production. Get the key from the project lead before the session, or use a screenshot fallback if a live key isn't available — do not surprise the audience with a login screen mid-walk-through.

### The question we're testing

Does the 4-persona model (gatherer / hunter / researcher / gifter), expressed as a probability vector, drive observably-different layouts on the same Bealls catalog — and does it survive contact with a product-team audience as something they'd adopt, modify, replace, or skip?

### Demo path (run in this order, one tab per intent)

| # | Action | URL | What to wait for |
|---|---|---|---|
| 1 | Load with explicit hunter intent | `https://aisles-demo-1-signal-x-studio-labs.vercel.app/?intent=hunter` | Layout finishes streaming (5–10s). Note copy density, grid columns, price treatment. |
| 2 | Load with explicit gatherer intent | `…/?intent=gatherer` | Same. Note editorial/lifestyle balance, hero presence, copy length. |
| 3 | Load with explicit researcher intent | `…/?intent=researcher` | Same. Note spec-forward language, comparison framing. |
| 4 | Load with explicit gifter intent | `…/?intent=gifter` | Same. Note occasion framing, curated-set sizing, gift CTA copy. |
| 5 | Open Observe dashboard in new tab | `…/observe` | Rules Fired panel shows `intent-param` for the active session; Layout Decision panel shows persona, model, cache HIT/MISS, generation latency. |
| 6 | Compare hunter vs. gatherer on a category | `…/category/women?intent=hunter` then `…/category/women?intent=gatherer` | Same products, different compositions. Density, sort emphasis, editorial header presence. |

### What to observe (specific, falsifiable)

- **Visible composition difference per persona on the same catalog.** Y/N. If N, the persona model isn't load-bearing in the layout — flag it.
- **Copy + curation distinctiveness more than block distinctiveness.** Empirically (per the 2026-04-30 PM-role run), the persona modulates voice/copy and curation choices (which products surface, which rail framing — "Best Sellers" vs. "Complete the Look" vs. "Customer Favorites") more than it modulates structural blocks. Hunter does get a distinctive price-tier tile primitive ("Under $10/$15/$20") and gifter gets a curated-set framing — those are real structural variations. Researcher and gatherer differentiate mainly through copy density. Don't expect a spec table on researcher today.
- **Brand voice survives persona variation.** The Bealls "comparable-value, up to 70% off" voice should be detectable across all four personas. If a persona produces copy that sounds off-brand, that's a brand-voice fidelity problem (STORY-019 territory), not a persona-model problem.
- **The LayoutBuildingState announces the persona** ("Building your homepage for a deal-driven shopper" / "discovery-driven" / "detail-driven" / "gift-driven"). Useful diagnostic during the walk-through; would a real shopper want this announcement, or is it a developer-facing artifact?
- **Latitude split is visible.** Home and PLP compositions vary noticeably across personas. Cart and checkout do not (if reached). Is this latitude split the right shape for our merchants?
- **Cache HIT vs. MISS in Observe.** First load per `(brandId, surface, persona, picks-hash)` is MISS at 5–10s; second load is HIT at <100ms. Is that latency profile acceptable for the kind of merchant our roadmap serves?

### What to bring back (the audience fills this in — verbatim)

Copy this block into a run doc under [`runs/`](runs/) and complete it during the walk-through. Empty fields = the walk-through didn't land.

```
Run date:
Audience role (PM / merch / etc.):
Persona model adoption recommendation (one of):
  ☐ Adopt as-is
  ☐ Adopt with modification — name the modification:
  ☐ Skip — let merchants author their own personas
  ☐ Skip — different model entirely (name it):
  ☐ Inconclusive — what additional data would close it:

Reasoning (bound to observed merchant scenarios — no abstractions):

Block / surface / latitude observations that surprised me:

Capabilities I want to extract into our roadmap regardless of the persona-model decision:

Things the artifact got wrong that would block adoption with our merchants:

If our merchants ran this, what would block them from operating it daily?
(Operability question — the persona model is interesting only if merchants
can tune, override, or trust it. Name the operability gap if you see one.)
```

### Failure modes to flag during the walk-through

- If all four personas produce the same layout, the persona vector isn't actually driving composition — flag to engineering, not product.
- If the LayoutBuildingState shows a persona but the streamed layout doesn't reflect it, the prompt is ignoring persona — flag.
- If Observe shows `intent-param` rule firing but persona stays at base prior, the inference cascade has a bug — flag.
- If the audience says "neat" with an empty bring-back: the walk-through structure failed, not the audience. Note it and escalate per RISK-07.

### Notes for the host

- Don't lead the audience to a recommendation. The walk-through is exploratory; the bring-back is the audience's call.
- Keep Observe visible during the layout transitions so the rule-firing trace is observable, not hypothetical.
- The static fallback hero ("Find your favorites for less") always renders pre-stream. Don't confuse it with the AI-composed hero. The AI portion replaces the skeleton grid below the building-state banner.

## Sponsor pitch — Product

**Audience:** product team sponsor (PM lead, GPM, or director who can slot a 30-min walk-through into a roadmap session)
**Asks for:** 30 minutes of one PM's time + a written bring-back
**Layer(s) demonstrated:** engine + foundation
**Anchored on:** [STORY-001](../STORY-001-persona-model-fit.md) (persona model fit)
**Reference run:** [`runs/STORY-001-2026-04-30-nino-pm-role.md`](../runs/STORY-001-2026-04-30-nino-pm-role.md)

### 30-second elevator

We have a working artifact — a Bealls storefront, AI-composed in real time, layout shifting per inferred shopper intent across four personas — and we want product to spend 30 minutes with it. Not to evaluate it as a product. To extract: which merchandising primitives, which composition behaviors, and which workflow shapes from this thing belong on **our** roadmap, regardless of whether Aisles itself ever ships. We've already authored the walk-through, the bring-back template forces a real recommendation, and one self-run is on file as the template.

### 30-minute agenda

| Minutes | Activity | Reference |
|---|---|---|
| 0–5 | Frame the experiment. *Aisles is not a product we're selling — it's an artifact our internal teams react to.* Three layers, three audiences. Today's question: persona model fit. | [NORTH-STAR §1](../../NORTH-STAR.md), [STRATEGY §2.1](../../STRATEGY.md) |
| 5–20 | Run the STORY-001 demo path: `?intent=hunter` → `gatherer` → `researcher` → `gifter` on demo-1, then a category page A/B (hunter vs. gatherer on `/category/women`). Watch copy, grid density, recommendation framing, price-tier blocks shift on the same catalog. | [STORY-001 demo path](../STORY-001-persona-model-fit.md) |
| 20–25 | Open `/observe` (host has key pre-warmed). Show the trace: signals fired → rules → probability vector → layout decision. **The PM's view is "this is what's underneath"** — it's not the merchant UI, but it's the underlying explanation. | STORY-001 step 5 |
| 25–30 | Bring-back capture. PM fills the template **in the room, not later.** The walk-through is incomplete if the bring-back is empty. | [STORY-001 bring-back template](../STORY-001-persona-model-fit.md#what-to-bring-back-the-audience-fills-this-in--verbatim) |

### What you'll bring back

The walk-through forces a verbatim recommendation across these dimensions (full template in STORY-001):

- **Persona model adoption** — adopt as-is, adopt with modification, skip / let merchants author, skip / different model entirely, or inconclusive (with the data needed to close it).
- **Capabilities to extract regardless of the persona-model decision** — merchandising primitives or composition behaviors worth pulling into our roadmap independent of "do we believe in 4 personas." The reference run extracted four: editorial-header generation, the price-tier-tile primitive, the curated-set / concierge-rail primitive, and the LayoutBuildingState pattern.
- **What the artifact gets wrong that would block adoption with our merchants** — verbatim, no diplomacy. The reference run flagged image-skeleton failures, the researcher-persona overstatement in PRD-ENG-009, and 10s cold-start latency.
- **PRD trace IDs touched** — STORY-001 binds to PRD-ENG-002, PRD-ENG-008, PRD-ENG-009 (see [STRATEGY §2.1](../../STRATEGY.md) for the per-audience extraction guide).

### Bealls touchpoints — what Bealls specifically demonstrates

- **Four-persona model on a real off-price catalog.** Hunter gets dense grids + price-tier tiles ("Under $10/$15/$20"); gatherer gets editorial layouts with curated-set framing; gifter gets occasion-language + "Customer Favorites" rails; researcher gets verbose value-comparison copy. Same catalog, four observable layouts.
- **Content-mode brand discipline.** Home Centric (demo-3) is content-only — no products, no cart, just locator + brand pillars. Real product split, not a toggle. Useful evidence for "is content-mode a feature category we've under-served?"
- **Multi-brand workspace pattern.** Three Vercel projects, one codebase, `BRAND_ID` env var. Bealls / Bealls Florida / Home Centric run side-by-side. Useful evidence for "what does merchant-grade multi-tenancy look like at the engine layer?"
- **Branded empty-rescue surfaces (just shipped 2026-04-30).** 404, empty-cart, empty-search, empty-wishlist all run through engine rescue with brand voice intact. Demonstrates that rescue is composable, not bolted on. PRD-FND-012.

### What success looks like for this run

- **Bring-back template filled, in the room, no empty fields.** Empty fields = the walk-through structure failed; that's a project-lead escalation per RISK-07.
- **At least one capability named that the PM would put on a roadmap regardless of the persona-model decision.** This is the strongest signal that the artifact extracted real value; it means a capability translated even if the persona model itself didn't.
- **At least one merchant-blocking observation.** "Neat" with no blockers means the PM didn't engage critically; the walk-through is the floor for honest extraction, not a polish review.

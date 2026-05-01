## Sponsor pitches — index

These are 1-pagers used to recruit a **sponsor** — one person inside product, engineering, or customer success — willing to slot a structured walk-through into a real meeting (roadmap review, tech spec, merchant call). They're the front door to the [walk-throughs](../README.md), which are what produce the artifact the experiment exists to generate (see [STRATEGY §2](../../STRATEGY.md)).

Without sponsors, the walk-throughs don't run. Without runs, RISK-07 (vanity demo) is unmitigated and the artifact stays neat-but-uncirculated. The pitches exist to close that gap by giving project lead something concrete to put in front of audience leads.

| Audience | Pitch | Walk-through anchor | Asks for |
|---|---|---|---|
| Product | [`product.md`](product.md) | [STORY-001](../STORY-001-persona-model-fit.md) | 30 min + written bring-back |
| Engineering | [`engineering.md`](engineering.md) | [STORY-006](../STORY-006-v-invariant-adoption.md) | 30–40 min + written bring-back |
| Customer success | [`customer-success.md`](customer-success.md) | [STORY-012](../STORY-012-merchant-explainability-demand.md) | 25 min + verbatim merchant transcript |

### How to use

1. **Project lead picks a sponsor candidate** in the target audience.
2. **Send them the relevant 1-pager.** Don't send all three at once; the audience-specific pitch is the version they should react to.
3. **Sponsor confirms 30 min on calendar** and identifies the actual audience-member who'll do the walk-through (the sponsor doesn't have to be the one in the seat).
4. **Host pre-warms cache + grabs the `/observe` key** before the session ([STORY prereqs](../README.md)).
5. **Walk-through runs against demo-1 / demo-2 / demo-3.** Bring-back captured **in the room, not later** — empty bring-backs mean the walk-through structure failed, not the audience.
6. **Run output lands in [`runs/`](../runs/)**, named `STORY-NNN-YYYY-MM-DD-{audience-or-handle}.md`.

### What these pitches deliberately don't do

- **Don't pitch Aisles as a product.** The artifact is an experiment surfacing capabilities; commitment comes from teams seeing it, not from a deck (per [NORTH-STAR §1](../../NORTH-STAR.md)).
- **Don't promise outcomes.** Sponsors agree to host a walk-through; they don't agree to a roadmap commitment, a tech adoption, or a merchant deal.
- **Don't substitute for the walk-through.** The pitch gets the meeting on the calendar. The walk-through doc is what the host runs from once the meeting starts.
- **Don't extend beyond one page.** If a pitch grows past one page of substance, the agenda is wrong, not the writing — re-scope to the audience-specific extraction question.

### Status

Authored 2026-05-01 alongside the FND-012 ship. Q-007 (sponsor cadence ownership) tracks resolution; status remains open until sponsors are actually identified per audience and a run lands per audience. Self-runs do not count toward Q-007 closure.

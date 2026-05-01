# Aisles — Internal-team Reactions / Walk-through Stories

> **v0.4.0 reframe note:** this doc was previously titled "Business Requirements / User Stories" and structured around merchant personas. Per the experimental framing pivot (2026-04-30), it is reframed around **internal-team reactions to artifact walk-throughs** — the stories are about commerce.com product/eng/CS teams interacting with the Bealls artifact, not about hypothetical merchant users.

**Status: stub.** Authored by Task #44.

Every story binds to a PRD capability trace ID. Stories are grouped by audience — three internal audiences (product / engineering / customer success), plus a "merchant-facing" group that captures stories *as Bealls would experience them* (since Bealls is the example merchant, their reactions are observable too).

## Story format

```
ID: STORY-001
Trace IDs: [PRD-ENG-003, PRD-ADM-001]
Audience: Engineering — reviewing the V invariant
Story: As an engineer evaluating Aisles' schema-typed AI output, I want to
       see how the schema validation cascade (Zod → structured output →
       fallback) handles malformed model responses, so I can decide
       whether the V invariant pattern is worth adopting in production
       services that emit structured AI output.
Acceptance: Walk-through includes a deliberate schema-violation injection;
            artifact shows the fallback cascade engaging; engineer can
            extract the validation pattern as production-grade.
```

## Stories — Product teams

> _to be authored. Examples to expect: "As a product manager evaluating the block catalog, I want to..."; "As a roadmap planner reviewing persona inference, I want to..."_

## Stories — Engineering teams

> _to be authored. Examples to expect: "As an engineer evaluating multi-tenancy patterns..."; "As an engineer evaluating AI Gateway routing..."_

## Stories — Customer success teams

> _to be authored. Examples to expect: "As a CS member walking a merchant through Bealls, I want to..."; "As a CS member reading merchant feedback on the Decisions Inspector..."_

## Stories — Merchant (Bealls-as-observed)

> _to be authored. These are not merchant user stories from speculative future Aisles customers — they are stories from Bealls' actual interactions with the artifact, captured by CS and engineering during the engagement._

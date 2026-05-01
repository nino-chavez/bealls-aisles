## Walk-throughs — index

These are the structured walk-throughs that mitigate RISK-07 (vanity demo). Each binds a BRD story to a concrete demo path, observation list, and "what to bring back" template. Without these, the artifact tends to produce "neat" reactions instead of artifacts our teams act on.

Per audience, one walk-through is canonical for the first round. Add more as new stories ship.

| ID | Story | Audience | Hypothesis | Status |
|---|---|---|---|---|
| [STORY-001](STORY-001-persona-model-fit.md) | Persona model fit | Product | H1 | ready |
| [STORY-006](STORY-006-v-invariant-adoption.md) | V invariant pattern adoption | Engineering | H1 | ready |
| [STORY-012](STORY-012-merchant-explainability-demand.md) | Merchant explainability demand | Customer success | H1 | ready (Inspector surrogate) |

Run outputs go in [`runs/`](runs/). Each run captures the verbatim "what they bring back" produced during the walk-through — the artifact the experiment exists to generate.

The end-of-session decision after the first run lives in `runs/decision-YYYY-MM-DD.md` and answers the question: **does the walk-through structure produce useful extraction, or does the experimental framing itself need adjusting?**

### Conventions

- One walk-through per story. ≤1 page. No exceptions.
- "What to bring back" is a **template the audience fills in**, not a list of bullet points the walk-through host prescribes.
- A run is incomplete if the "what to bring back" section is empty. "Neat" is not an artifact.
- If a walk-through repeatedly produces empty bring-back sections across audiences, the structure is wrong — escalate to project lead, not back to the audience.

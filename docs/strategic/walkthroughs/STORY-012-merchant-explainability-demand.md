## STORY-012 walk-through — Merchant explainability demand

**Audience:** customer success
**Hypothesis tested:** H1 (schema-typed generative composition is production-viable, specifically the explainability claim) + RISK-06 (merchants reject "AI built something we didn't approve")
**Layer(s) exercised:** engine (signal/inference trace) + admin (Inspector surrogate via `/observe`)
**Trace IDs:** PRD-ADM-003, PRD-ADM-004
**Time budget:** 25 min walk-through + verbatim merchant transcript capture
**Prereqs:**
- Browser, two tabs (storefront + Observe). Recording or note-taking.
- **A merchant** (or stand-in audience playing the role).
- **Host has the Observe key.** `/observe` is gated in production. Get the key from the project lead before the session, or fall back to annotated screenshots — surprising the merchant with a login screen during the explainability demo defeats the demo.
- **Host pre-warms the artifact.** Cold first-gen is 5–10s; the demo loses momentum if the merchant watches loading skeletons during persona transitions. Hit `?intent=hunter` and the cold default once before the session.

### Important caveat — read this first

The polished, merchant-facing **Decisions Inspector with permalinks per decision (PRD-ADM-003)** is **building (Phase 4)** — not shipped. The `/observe` dashboard is the developer-facing equivalent: it has the same trace data (signals → rules fired → persona → model → layout) but the UI is engineer-grade, not merchandiser-grade. **Do not pitch `/observe` as the Inspector.** Use it as the surrogate that lets us test whether merchants engage with the *underlying explanation* even before the merchant-grade UI exists.

If a merchant disengages with `/observe`, that may be a UI problem, not an explainability-demand problem — capture which it is in the bring-back.

### The question we're testing

When merchants see the underlying "why did the AI do this" trace, do they engage with it (ask follow-up, suggest changes, want it on their account) or treat it as a developer feature and move on? The answer informs whether explainability is a winning conversation lever or a feature merchants ignore.

### Demo path

| # | Action | URL | What to do/say |
|---|---|---|---|
| 1 | Open the storefront, no intent param | `https://aisles-demo-1-signal-x-studio-labs.vercel.app/` | Let merchant see the cold-start (gatherer-default) homepage. Don't explain anything yet. |
| 2 | Switch to `?intent=hunter` | `…/?intent=hunter` | Let the layout transition. Ask: "what changed and why do you think it changed?" Capture verbatim. |
| 3 | Open `/observe` in a second tab | `…/observe` | Frame: "this is the engineer's view of what just happened. The merchant view will be friendlier — but the underlying trace is the same." |
| 4 | Walk the trace top-to-bottom | `/observe` panels | (a) Signals fired (request.pageview, request.device, intent-param). (b) Rules Fired panel — `intent-param` rule with weight, persona adjustments. (c) Probability vector. (d) Layout Decision — model used, cache HIT/MISS, generation time, cost. |
| 5 | Open one bealls.com competitive personalization tool in a third tab if available | (any incumbent — DY/Monetate/Adobe Target if shown previously) | Compare: where in their current tool can they see "the AI showed this layout because…"? Capture answer verbatim. |
| 6 | Ask the closing question | — | "If you had this — but in a friendly merchant UI — would you use it weekly, monthly, never? On which surface? For which kind of question?" Capture verbatim. |

### What to observe (verbatim, not paraphrased)

- **First reaction to the trace.** Did the merchant lean in or sit back? Note body language if in person.
- **The first question the merchant asked.** Was it about a signal? A rule? The persona model? The layout? Or about who can see this / change this / when?
- **The language the merchant used.** "Why did it…" vs. "Did it really…" vs. "Can I change…" vs. "How do I trust this…" — each implies a different demand. Quote verbatim.
- **What they ignored.** If the merchant skipped past the Rules Fired panel and only reacted to "model" / "cost" — that's a signal about which trace dimensions they care about. Note absences.
- **Did they ask about override?** "Can I pin a product?" "Can I turn this off for [category]?" "Can I roll back?" — these reveal whether explainability is the *primary* demand or a *secondary* demand under "control."
- **Did they ask about audit?** "Who else can change this?" "Do I see what changed yesterday?" — RBAC + audit-log demand surfaces here.

### What to bring back (the audience fills this in — verbatim)

```
Run date:
Merchant (or role of stand-in):
Merchant size / vertical / current personalization tool:

Verbatim merchant reaction to the trace (first 3 sentences they spoke):

The first follow-up question the merchant asked:

The language the merchant used (5 of their actual words/phrases):

Did the merchant want explainability primarily, control primarily, or both? Evidence:

Comparison with their current tool (verbatim quote on whether they can answer "why" today):

Closing-question answer (would-use-weekly / monthly / never; which surface; which question type):

Decision-matrix entry (this merchant's profile + Inspector reaction):
  ☐ Explainability closes the deal for this merchant type
  ☐ Explainability is a "nice-to-have" but not load-bearing
  ☐ Explainability is a developer feature this merchant doesn't care about
  ☐ Explainability isn't the demand — control / override / audit is

What this tells us about the Phase 4 Inspector design (specific UI changes, missing data, etc.):
```

### Failure modes to flag during the walk-through

- **If the merchant's eyes glaze on `/observe`**: most likely a UI gap, not a demand gap. Capture quote: "I'd want this if it looked like…" Note that as a Phase 4 design input, not a hypothesis-disconfirming signal.
- **If the merchant says "this is a developer feature, not for me"**: that's directly RISK-06 (merchants prefer AI-assistance over AI-authoring). Capture verbatim and tag the run with RISK-06.
- **If the merchant immediately asks for override controls before explainability**: capture exact language. Suggests Decisions Inspector should bundle override CTAs from day one (Phase 4 design input).
- **If the merchant's bring-back is empty**: walk-through is the wrong shape for CS use; revisit before running with another merchant.

### Notes for the host

- Don't defend the artifact. The walk-through is observation, not pitch. If the merchant pushes back, capture; don't argue.
- **Don't claim `/observe` is the merchant Inspector.** Repeat the framing every time: this is the underlying data; the merchant view ships in Phase 4.
- The verbatim transcript is the artifact. Paraphrased reactions are noise — the experiment can't extract patterns from them.
- After 3 merchant runs of this story, look for a pattern in the bring-backs: are merchants asking "why" or "can I"? That single distinction informs whether the Phase 4 build is Inspector-first or Override-first.

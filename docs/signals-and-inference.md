# Aisles — Signals and Inference

**Version**: 0.2.0
**Last Updated**: 2026-04-06
**Audience**: Developers

## Overview

The Aisles persona inference system is a continuous signal stream → probability vector pipeline. It reads signals from two sources (server-side request data and client-side behavioral events), evaluates 16 weighted rules against the accumulated context, and produces a `PersonaInference` object that drives layout generation.

This document covers all 14 signal types, all 16 inference rules, the probability computation model, the modifier system, and the planned expansion to behavioral and negative signals.

---

## The Four Personas

Everything in the inference engine maps to four shopper archetypes. All types are defined in `src/lib/signals/types.ts`.

| Persona | Description |
|---|---|
| `gatherer` | Exploratory, inspiration-driven. Browsing aesthetics and editorial content. Not ready to buy — wants to discover. |
| `hunter` | Goal-oriented, efficiency-driven. Knows what they need, wants the specs and price fast. |
| `researcher` | Methodical, evidence-driven. Comparing options systematically. Wants data, not stories. |
| `gifter` | Shopping for someone else. Needs curation, universal appeal, and safe price points. |

The `PersonaProbabilities` type is always a normalized distribution summing to 1.0:

```typescript
interface PersonaProbabilities {
  gatherer: number;
  hunter: number;
  researcher: number;
  gifter: number;
}
```

---

## The 14 Signal Types

Signals are typed events with a fixed schema. Each event has a `type`, a `source`, a `data` payload, and a `context` (current page, category, viewport).

```typescript
type SignalEventType =
  // Request signals — server-side, emitted on every page load
  | 'request.pageview'
  | 'request.device'
  | 'request.geo'
  | 'request.search_landing'
  | 'request.returning'
  // Navigation signals — client-side
  | 'nav.category_view'
  | 'nav.product_view'
  | 'nav.search'
  | 'nav.back'
  // Interaction signals — client-side (Phase 3+)
  | 'interact.scroll_depth'
  | 'interact.dwell_time'
  | 'interact.filter_use'
  | 'interact.sort_change'
  // Commerce signals — client-side
  | 'commerce.add_to_cart'
  // Refinement signals — client-side
  | 'refine.message';
```

### Signal Status

Of these 14 types, only 4 are currently consumed by the inference engine. The remaining 10 are defined in the schema and emitted (or planned for emission) but their data is not yet read by any inference rule.

| Signal Type | Source | Emitter | What It Captures | Inference Status |
|---|---|---|---|---|
| `request.pageview` | Server | `src/lib/signals/request.ts` | Referrer, UTM params, intent param | **Consumed** — feeds referrer, UTM, and intent rules |
| `request.device` | Server | `src/lib/signals/request.ts` | User-agent → device type | **Consumed** — feeds device+time rules |
| `request.geo` | Server | Not yet emitted | Visitor geography | **Not emitted, not consumed** |
| `request.search_landing` | Server | `src/lib/signals/request.ts` | `?q=` query string on landing | **Consumed** — feeds search keyword rules |
| `request.returning` | Server | `src/lib/signals/request.ts` | Previous persona, previous category, visit count | **Partially consumed** — visitCount feeds familiarity rule; previousPersona/Category feed cross-session rules |
| `nav.category_view` | Client | `src/lib/signals/emitter.ts` (via `afterNavigate`) | Category entered | **Partially consumed** — updates `currentCategory` in `toInferenceContext()`, but does not feed any rule with category-sequence data |
| `nav.product_view` | Client | Not yet emitted | Product detail page viewed | **Not emitted, not consumed** |
| `nav.search` | Client | Not yet emitted as a standalone call | Search query from in-page search | **Partially consumed** — `toInferenceContext()` extracts the query and overwrites `searchQuery` |
| `nav.back` | Client | Not yet emitted | Browser back-navigation | **Not emitted, not consumed** |
| `interact.scroll_depth` | Client | Not yet emitted | How far down the page the shopper scrolled | **Not emitted, not consumed** |
| `interact.dwell_time` | Client | Not yet emitted | Time spent on a product card or section | **Not emitted, not consumed** |
| `interact.filter_use` | Client | Not yet emitted | Filter panel interactions | **Not emitted, not consumed** |
| `interact.sort_change` | Client | Not yet emitted | Sort order changes | **Not emitted, not consumed** |
| `commerce.add_to_cart` | Client | `src/lib/signals/emitter.ts` (immediate flush) | Product added to cart | **Not consumed** — emitted and flushed immediately, but inference engine reads no rule against it |
| `refine.message` | Client | `src/lib/signals/emitter.ts` (immediate flush) | Refinement chat message sent | **Not consumed by inference** — triggers a separate refinement generation, does not modify persona probabilities |

The gap between defined and consumed signals is the primary target of the behavioral signal expansion described in `docs/specs/behavioral-signals.md`.

---

## Signal Collection Architecture

### Server-Side: `request.ts`

`src/lib/signals/request.ts` runs on every SvelteKit server load. It:

1. Reads or creates the `aisles_session` cookie (UUID, 30-day TTL)
2. Retrieves or creates the session's `SignalStore` from Redis (via `getSessionStore`)
3. Reads cross-session cookies: `aisles_persona`, `aisles_last_category`, `aisles_visits`
4. Emits `request.pageview`, `request.device`, and (conditionally) `request.search_landing` and `request.returning`
5. Persists the updated store back to Redis

The server-side signals are the only signals available at the time the layout prompt is built. They represent the best inference the engine can make from a single HTTP request.

### Client-Side: `emitter.ts`

`src/lib/signals/emitter.ts` runs in the browser after page load. `SignalEmitter`:

- Buffers events in memory
- Flushes to `POST /api/signals` every 5 seconds
- Flushes immediately for high-priority events: `commerce.add_to_cart`, `refine.message`, `nav.search`
- On a successful flush, receives the updated `PersonaInference` in the response body and dispatches a `aisles-inference-update` CustomEvent

The emitter is a singleton, initialized once in `+layout.svelte` via `initEmitter()` and destroyed on layout teardown.

Currently, the emitter emits `nav.category_view` via `afterNavigate`. The `commerce.add_to_cart` and `refine.message` events are emitted at the point of user action. The interaction signals (`interact.*`) and `nav.back` are not yet emitted.

### The Store: `store.ts`

`SignalStore` is the session-scoped event buffer. It accumulates `SignalEvent` objects from both server-side and client-side sources and exposes `toInferenceContext()`, which is the bridge to the inference engine.

`toInferenceContext()` loops over all accumulated events and extracts the values the inference rules expect:

```typescript
// Only these event types are read by toInferenceContext():
case 'request.pageview':   // → referrer, utm_*, intent
case 'request.device':     // → deviceType
case 'request.search_landing': // → searchQuery
case 'nav.search':         // → searchQuery (overwrite)
case 'nav.category_view':  // → currentCategory (update)
```

Events for `nav.product_view`, `nav.back`, all `interact.*`, `commerce.add_to_cart`, and `refine.message` are stored in the buffer but the `switch` statement has no `case` for them. They accumulate but are invisible to the inference engine in the current implementation.

---

## The 16 Inference Rules

All rules are defined in `src/lib/signals/inference.ts`. Each rule has a `name`, a `weight` (confidence multiplier, 0.0–1.0), and an `evaluate` function that takes an `InferenceContext` and returns a `PersonaScoreAdjustment | null`.

A `PersonaScoreAdjustment` can contain any combination of:
- Persona score boosts (`gatherer`, `hunter`, `researcher`, `gifter`)
- Modifier adjustments (`priceSensitivity`, `urgency`, `familiarityWithStore`)

### Rule Catalog

| Rule Name | Weight | Signals Used | What It Detects | Output |
|---|---|---|---|---|
| `intent-param` | 1.0 | `intentParam` | `?intent=hunter` (or any valid persona) in the URL | `+0.8` to the named persona |
| `search-hunter-keywords` | 0.9 | `searchQuery` | Query matches `/cheap|budget|deal|dorm|under \$|affordable|sale|discount|clearance/` | `+0.4 hunter`, `+0.5 priceSensitivity` |
| `search-researcher-keywords` | 0.9 | `searchQuery` | Query matches `/review|compare|spec|vs\b|rating|best|versus|dimension|material/` | `+0.4 researcher` |
| `search-gifter-keywords` | 0.9 | `searchQuery` | Query matches `/gift|birthday|anniversary|present|for him|for her|housewarming|wedding/` | `+0.5 gifter` |
| `search-gatherer-keywords` | 0.8 | `searchQuery` | Query matches `/browse|explore|inspiration|ideas|modern|style|aesthetic|cozy/` | `+0.3 gatherer` |
| `referrer-social` | 0.7 | `referrer` | Referrer matches `/pinterest|instagram|houzz/` | `+0.3 gatherer` |
| `referrer-deal-site` | 0.7 | `referrer` | Referrer matches `/slickdeals|retailmenot|honey|google\.com\/shopping/` | `+0.3 hunter`, `+0.3 priceSensitivity` |
| `referrer-review-site` | 0.7 | `referrer` | Referrer matches `/wirecutter|consumerreports|reddit/` | `+0.3 researcher` |
| `utm-gift-campaign` | 0.8 | `utmCampaign`, `utmSource` | Campaign matches `/gift|holiday|mother|father|wedding/` | `+0.4 gifter` |
| `utm-sale-campaign` | 0.7 | `utmCampaign` | Campaign matches `/sale|clearance|deal|promo/` | `+0.2 hunter`, `+0.3 priceSensitivity` |
| `mobile-evening-impulse` | 0.5 | `deviceType`, `hourOfDay` | Mobile device, hour >= 20 or <= 5 | `+0.1 hunter`, `+0.2 urgency` |
| `desktop-weekday-deliberate` | 0.4 | `deviceType`, `dayOfWeek`, `hourOfDay` | Desktop, Mon–Fri, 9:00–17:00 | `+0.1 researcher` |
| `returning-same-category` | 0.7 | `storedPersona`, `storedCategory`, `currentCategory` | Returning visitor, in the same category as their last visit | `+0.3` to stored persona, `+0.2 familiarityWithStore` |
| `returning-different-category` | 0.5 | `storedPersona`, `storedCategory`, `currentCategory` | Returning visitor, different category | `+0.1` to stored persona, `+0.1 familiarityWithStore` |
| `repeat-visitor-familiarity` | 0.5 | `visitCount` | Visit count > 1 | `+familiarityWithStore` scaled by `min(visitCount / 10, 1.0) * 0.3` |

Note: The rule catalog shows 15 rows. The 16th entry in `inference.ts` does not exist — the count in the architecture doc reflects 16 evaluation paths when including the intent-param's PERSONAS loop, but there are 15 discrete `InferenceRule` objects in the `rules` array.

### The Base Prior

Before any rule fires, scores start at:

```typescript
const BASE_SCORES: PersonaProbabilities = {
  gatherer: 0.3,
  hunter: 0.2,
  researcher: 0.2,
  gifter: 0.1,
};
```

On a cold-start session with no rules matching, normalization yields approximately `gatherer: 0.375, hunter: 0.25, researcher: 0.25, gifter: 0.125`. This is a deliberate choice — the default experience is the most exploratory layout (gatherer), which is safer than an efficiency-first default for an unknown shopper.

---

## Score Computation and Normalization

The engine runs every rule against the current `InferenceContext`. For each rule that returns a non-null adjustment:

1. The adjustment's persona scores are multiplied by `rule.weight` and added to `scores[persona]`
2. The adjustment's modifier values (if any) are multiplied by `rule.weight` and clamped to `[0, 1]`
3. A `RuleMatch` entry is appended to `ruleMatches` with a human-readable reason from `describeRuleMatch()`

After all rules are evaluated, scores are normalized to a probability distribution:

```typescript
const total = scores.gatherer + scores.hunter + scores.researcher + scores.gifter;
const probabilities = {
  gatherer: scores.gatherer / total,
  hunter: scores.hunter / total,
  researcher: scores.researcher / total,
  gifter: scores.gifter / total,
};
```

The normalization step means that absolute score magnitudes do not matter — only relative differences between personas. A single high-weight rule that fires (e.g., `intent-param` at weight 1.0 adding +0.8 to hunter) will dominate a cold-start session; multiple lower-weight rules firing together can overcome a single strong signal.

---

## The `PersonaInference` Output

The `infer()` function returns:

```typescript
interface PersonaInference {
  probabilities: PersonaProbabilities; // Normalized, sums to 1.0
  primary: Persona;                    // Highest probability persona
  confidence: number;                  // Gap: primary.prob - second.prob
  modifiers: PersonaModifiers;
  shift: PersonaShift;
  signalCount: number;                 // How many rules fired
  lastUpdated: number;                 // Unix ms timestamp
  dominantSource: SignalSource;        // Always 'request' currently
  ruleMatches: RuleMatch[];            // Which rules fired and why
}
```

### Confidence

Confidence is not an absolute certainty measure — it is the probability gap between the primary persona and the runner-up. A confidence of 0.30 means the primary is 30 percentage points ahead of second place. Below 0.15, the engine treats the result as low-confidence (the two leading personas are nearly tied).

### Modifiers

```typescript
interface PersonaModifiers {
  priceSensitivity: number;     // 0 = indifferent to price, 1 = very budget-driven
  urgency: number;              // 0 = browsing, 1 = buying now
  familiarityWithStore: number; // 0 = first visit, 1 = loyal returning customer
}
```

Modifiers are computed alongside persona scores but are not part of the normalization. They are currently available in the inference output but are not yet used to modify layout prompts. They appear in the Observe dashboard's gauge row.

### Shift Detection

If the current session has a `storedPersona` (from the `aisles_persona` cookie) and the newly inferred `primary` differs from it, and the confidence gap is >= 0.1, a shift is detected:

```typescript
interface PersonaShift {
  detected: boolean;
  from: Persona | null;  // The stored persona
  trigger: string | null; // Human-readable cause
}
```

The trigger description is derived from whichever signal caused the shift: search query, intent param, UTM campaign, or referrer.

### Rule Attribution

Every `PersonaInference` includes a `ruleMatches` array documenting which rules fired:

```typescript
interface RuleMatch {
  ruleName: string;
  weight: number;
  adjustment: PersonaScoreAdjustment;
  reason: string; // e.g. 'Search "dorm desk" matches deal/budget keywords'
}
```

This is the primary tool for debugging inference behavior. The Observe dashboard's signal timeline shows rule matches, and the `/observe` endpoint exposes them directly. See `docs/development.md` for how to use rule attribution during development.

---

## How Inference Feeds Layout Generation

The `buildLayoutPrompt()` function in `src/lib/server/layout-prompt.ts` currently receives only the `primary` persona label as a string. The full probability vector is not passed to the AI.

```typescript
// Current call site:
buildLayoutPrompt(
  inference.primary,  // e.g. 'hunter' — just the label
  categoryName,
  products,
  picksContext,
  rulesContext,
)
```

This is a known limitation. A session where `hunter: 0.51, gatherer: 0.49` (nearly tied) generates the same hunter layout as a session where `hunter: 0.90, gatherer: 0.05` (strongly certain). The planned Phase 4 expansion (see `docs/specs/behavioral-signals.md`) will pass the full `PersonaProbabilities` object into the prompt, allowing the AI to blend layout styles for ambiguous sessions.

---

## The Gap: 10 of 14 Signals Not Consumed

The following signals are either emitted but not read by inference rules, or defined but not yet emitted:

**Emitted but not consumed by inference rules:**
- `commerce.add_to_cart` — the most commercially significant behavioral signal. Adding to cart is strong hunter/gifter intent evidence.
- `nav.category_view` — updates `currentCategory` in the store but the sequence of categories visited is not used by any rule.
- `refine.message` — the text of the message is not analyzed for persona signals.

**Defined but not yet emitted:**
- `nav.product_view` — product dwell tracking requires an observer on the PDP route.
- `nav.back` — back-navigation patterns are a negative signal (the shopper rejected what they saw).
- `interact.scroll_depth` — requires an IntersectionObserver or scroll event listener.
- `interact.dwell_time` — requires timing logic around product card visibility.
- `interact.filter_use` — requires event hooks on the filter panel component.
- `interact.sort_change` — requires an event hook on the sort control component.
- `request.geo` — requires GeoIP lookup or Vercel's `x-vercel-ip-country` header.

---

## Planned Expansion

The behavioral signal expansion is detailed in `docs/specs/behavioral-signals.md`. In brief:

**Phase 1** — Wire existing unused signals into new inference rules. `nav.category_view` sequence, `nav.search` events, and `commerce.add_to_cart` all have enough information to feed rules today without new emitter code.

**Phase 2** — Emit the `interact.*` signals and add the rules that consume them. Dwell time and scroll depth are the highest-value additions: they measure engagement depth without requiring the shopper to take an explicit action.

**Phase 3** — Negative signals. Bounce detection, cart removal, and chat abandonment. These are the Spotify-skip equivalents — the signals that most quickly reveal what a persona is NOT.

**Phase 4** — Pass the full probability vector into layout prompts instead of just the primary label. Enables blended layouts for ambiguous personas.

**Phase 5** — Session arc modeling. Track persona trajectory across the session (e.g., started as gatherer, progressively shifted toward hunter over five page views) and use the trajectory to predict the terminal persona.

---

## Related Documentation

- `src/lib/signals/types.ts` — all type definitions
- `src/lib/signals/inference.ts` — rule implementations and `infer()` function
- `src/lib/signals/store.ts` — `SignalStore` and `toInferenceContext()`
- `src/lib/signals/emitter.ts` — client-side signal emission
- `src/lib/signals/request.ts` — server-side signal extraction
- `src/lib/server/layout-prompt.ts` — how inference output feeds layout generation
- `docs/specs/behavioral-signals.md` — expansion implementation spec
- `docs/architecture.md` — system-level data flow
- `docs/observe.md` — how to observe inference in real time
- `docs/development.md` — debugging inference during development

# Aisles — Capabilities Demonstrated

> **v0.4.0 reframe note:** this doc was previously titled "Product Requirements" and structured as "what the system must do." Per the experimental framing pivot (2026-04-30), it is reframed as **capabilities demonstrated** — what the artifact shows, which hypothesis each capability tests, which internal audience extracts value, and what acceptance looks like for the demonstration (not for a product launch).

**Status: stub.** Authored by Task #44 after NORTH-STAR + STRATEGY are locked.

Every capability here is bound to a trace ID in `traceability.json` and traces back to a hypothesis in [`STRATEGY.md`](../strategic/STRATEGY.md) §3 and forward to BRD entries (internal-team reactions).

---

## Capability table

| Trace ID | Layer(s) | Capability demonstrated | Hypothesis tested | Primary audience | Acceptance (demonstration) |
|---|---|---|---|---|---|
| _to be authored_ | _engine / foundation / admin_ | _what the artifact shows_ | _H1 / H2 / H3 from STRATEGY §3_ | _product / eng / CS_ | _what "we demonstrated this" looks like_ |

---

## Layer-keyed indexes

> _to be authored — three index sections, one per layer, listing trace IDs grouped by capability._

### Engine capabilities

### Foundation capabilities

### Admin capabilities

---

## Cross-layer capabilities

> _Capabilities that explicitly span layers and demonstrate the cross-layer contracts STRATEGY hypothesizes about. Examples to expect:_
>
> - Merchant authors a coupon rule in admin → engine surfaces it on PLP/PDP → foundation honors it in cart/checkout. Demonstrates the Engine ↔ Admin contract and the Foundation ↔ Engine contract simultaneously.
> - Engine composes a `for-you-row` → foundation cart preserves the personalization context across to checkout. Demonstrates state continuity across the engine→foundation handoff.

---

## Audience-keyed views

For each audience, the capabilities that matter most for their extraction. The same capability can appear in multiple audience views with different framing.

### What product teams see

> _to be authored: the slice of capabilities most relevant for "what should we adopt into our roadmap?"_

### What engineering teams see

> _to be authored: the slice of capabilities most relevant for "what patterns should we copy into production?"_

### What customer success teams see

> _to be authored: the slice of capabilities most relevant for "what merchant conversations does this enable?"_

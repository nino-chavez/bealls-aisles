# Strategic Risks & Fallback Paths

> **Status: stub.** Per the Atelier convention, risks live separate from spec. Each entry names a load-bearing strategic bet, the failure mode, and the fallback path.

## Format

```
RISK-NN: <title>
Bet: <what we're betting on>
Failure mode: <what happens if the bet is wrong>
Trigger signal: <how we detect the bet is failing>
Fallback path: <what we do instead, and what it costs>
Owner: <who watches this>
```

## Active risks

> _to be authored alongside STRATEGY by Task #42. Initial candidates:_
>
> - **RISK-01: AI composition latency** — Bet: 5–10s wait acceptable for AI-personalized homepage. Failure: shoppers bounce. Fallback: streaming partials + static fallback shipped (already mitigated).
> - **RISK-02: Schema lock-in** — Bet: 6 surface schemas cover 90% of ecomm sites. Failure: merchants need a 7th surface (e.g., subscription portal) that doesn't fit. Fallback: extension hook in admin to add surface schemas without engine change.
> - **RISK-03: Demo→product gap** — Bet: Bealls demo translates to commerce.com merchant pitch. Failure: features that demo well don't sell. Fallback: pivot to two-three additional merchants in research before commit (Task #43 research output).
> - **RISK-04: Merchant authoring complexity** — Bet: merchandisers can author rules without engineer support. Failure: rule UI is too complex, merchants ignore the admin. Fallback: managed services / templates per merchant tier.

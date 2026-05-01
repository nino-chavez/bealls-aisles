# Aisles — Strategy

> **Status: stub.** Drafted in: this doc will articulate why Aisles takes the shape it does, what's in scope, what's out, and how it positions against Dynamic Yield, Monetate, Bloomreach Discovery, Salesforce Personalization Builder, Adobe Target, and Algolia Recommend.
>
> **Stakeholders:** commerce.com product leadership.
> **Goal:** sellable merchant features demonstrable with Bealls (and its family of brands) as the example merchant.
> **Authoring:** this doc is filled in by Task #42 after the BigBlueprint Stage 1 research (Task #43) returns.

## What Aisles is

A three-layer commercial product (per the [Aisles product framing](../../README.md) and Atelier's three-tier engagement model):

1. **Engine** — AI page composition, persona inference, signal pipeline, layout generation.
2. **Foundation** — table-stakes ecommerce (catalog, cart, checkout, account, search, locator) that exists whether or not the engine personalizes it.
3. **Admin control plane** — merchant override, configuration, observability, content authoring (lives in `aisles-admin`, separate deployment).

## What Aisles is NOT

> _to be filled in._ Initial constraints to formalize:
>
> - Not a full headless CMS (foundation is opinionated, not extensible like Contentful).
> - Not a payment processor (uses Stripe / BC native).
> - Not a search engine in its own right (uses BC + AI signal layer; comparison vs. Algolia goes here).
> - Not an analytics platform (observability surfaces signals; Mixpanel/Amplitude integration goes elsewhere).

## Competitive positioning

> _to be filled in by Task #43 research._ Comparison axes to populate:
>
> | Axis | Aisles | Dynamic Yield | Monetate | Bloomreach Discovery | Salesforce Personalization Builder | Adobe Target | Algolia Recommend |
> |---|---|---|---|---|---|---|---|
> | Composition latitude | Wide (per surface) | Insertion-only | Insertion-only | Search + recs | Insertion + email | A/B + insertion | Recs only |
> | Schema-typed AI | ? | No | No | No | No | No | No |
> | Persona inference | ? | Yes | Yes | Limited | Yes | Yes | No |
> | Multi-brand | ? | Yes | Yes | Yes | Yes | Yes | Yes |
> | BigCommerce-native | Yes | Plug | Plug | Plug | No | Plug | Plug |
> | Pricing model | ? | License | License | License | Per-cloud | License | Per-MAU |

## Out of scope (explicitly)

> _to be filled in._ Initial candidates:
>
> - Real-time personalization < 100ms (we target seconds-fresh, not millisecond)
> - Subscription commerce (Aisles is one-time-purchase first)
> - B2B catalogs / negotiated pricing
> - Marketplace / multi-seller flows

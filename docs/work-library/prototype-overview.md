# Bealls Aisles

**Status:** Draft internal publication package  
**Role:** Working R&D prototype and composition-safety reference  
**Human validation:** Pending

## Answer

Bealls Aisles shows that one storefront engine can render multiple brand
configurations and constrain AI-composed pages to a typed block vocabulary. Its
reusable platform contribution is the graduated composition-latitude contract:
the closer a surface is to conversion, the less structural freedom the model
receives.

It does not prove merchant demand, incremental revenue, category transfer,
production readiness, or a case for a shared inference platform.

## Example-merchant boundary

Bealls, Bealls Florida, and Home Centric appear here only as an example merchant
family used to make the prototype concrete. This is independent research and
development. It is not affiliated with, endorsed by, or a commercial
engagement with Bealls Inc. Product data and imagery are demo content.

## What exists

- One codebase serves three distinct brand configurations.
- The prototype includes a composition engine, commerce foundation, and an
  operator-facing explanation surface.
- Generated layouts come from a finite, typed component vocabulary with a
  fallback to a known layout.
- Home, product-listing, and basic product-detail surfaces are implemented.
  Other commerce surfaces are incomplete or stubbed.
- The repository describes this as an “art of the possible” artifact to react
  to and pull capabilities from, not a product being sold.

## The reusable contract

The [composition taxonomy](../architecture/engine/composition-taxonomy.md)
defines four levels of model freedom:

| Latitude | Typical surfaces | Structural freedom |
| --- | --- | --- |
| Wide | Home and rescue states | Compose the view inside fixed brand chrome |
| Medium | Product listings and account | Compose inside known zones |
| Narrow | Product detail | Insert only at named anchors |
| Fixed | Cart and checkout | Personalize copy or upsells; do not reorder steps |

This contract can guide platform design without adopting the Bealls Aisles
codebase or funding a generalized inference engine.

## What remains unproven

- No randomized control or holdout measures merchant outcomes.
- No evidence shows that the adaptive experience improves conversion, average
  order value, or revenue per session.
- One offline calibration found category-specific rule inversions, but that work
  uses heuristic labels and lives on an unmerged branch. It is diagnostic
  evidence, not merchant-outcome evidence.
- A deployed root returning a page does not prove catalog integrity, operator
  readiness, recovery, or production safety.

## Decision use

Use this case to inspect the working prototype and the composition-safety
contract. Use the linked Aisles competitive-position case for the investment
decision: publish the contract as guidance, run one bounded merchant holdout,
and leave the shared platform unfunded until the outcome is credible.

## Canonical sources

- Repository overview: `README.md`
- Composition contract: `docs/architecture/engine/composition-taxonomy.md`
- Publication lifecycle and allowlist: `work-library.publication.yml`


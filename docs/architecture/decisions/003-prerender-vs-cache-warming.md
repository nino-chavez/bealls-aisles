# Decision Record: Pre-render at Build Time vs Cache Warming

**Date:** 2026-04-06
**Status:** Superseded 2026-08-13 by route-bound named-zone decisions
**Context:** Cold start performance optimization

## Question

Should we prerender category pages at build time via SvelteKit's prerendering, or warm the Redis cache post-deploy?

## Decision

Cache warming. Prerendering bakes a single layout into static HTML, but Aisles layouts are persona-dependent — the same URL renders differently for each persona. Prerendering would only serve one persona's layout statically, defeating the thesis.

Cache warming fills the Redis cache with layouts for each persona+category combination. The runtime serves the correct cached layout based on the detected persona.

## Current implementation boundary

The whole-layout cache and its anonymous post-deploy warmer are retired. Shopper model execution is also retired. `/api/layout` rejects before input, cache, catalog, or provider work. The decision-envelope cache infrastructure remains fail-closed: any future authorized producer must store and revalidate the complete decision and provenance envelope, including organization, brand, route, surface, expanded zone, policy, reference, viewport, catalog/content, synthetic provenance, and approved input.

`scripts/warm-cache.ts` now fails without making network requests. `npm run prewarm` was removed because its referenced implementation did not exist. A future warmer needs a separately authenticated merchant authority and must cache the complete validated envelope; shopper URLs or client-supplied surfaces are not acceptable.

## When to revisit

Revisit only with an authenticated merchant operation, server-owned inputs, and explicit cost and concurrency limits. Static brand fallbacks remain required even if ISR is added.

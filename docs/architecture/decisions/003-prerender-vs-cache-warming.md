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

The whole-layout cache and its anonymous post-deploy warmer are retired. Shopper model output is limited to signed, route-bound cart and checkout zones. Cache entries contain a validated decision and provenance envelope keyed by the full organization, brand, route, surface, expanded-zone, policy, reference, viewport, catalog/content, synthetic-provenance, and approved-input context.

`scripts/warm-cache.ts` now fails without making network requests. `npm run prewarm` was removed because its referenced implementation did not exist and a route-less warmer cannot satisfy the signed grant. A future warmer needs a server-trusted route context and must cache the complete validated envelope; a client-supplied surface is not acceptable.

## When to revisit

Revisit only if a warmer can mint the same scoped authority as a real consuming route without becoming a reusable cross-route capability. Static brand fallbacks remain required even if ISR is added.

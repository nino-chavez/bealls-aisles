# Decision Record: Pre-render at Build Time vs Cache Warming

**Date:** 2026-04-06
**Status:** Cache warming chosen over prerendering
**Context:** Cold start performance optimization

## Question

Should we prerender category pages at build time via SvelteKit's prerendering, or warm the Redis cache post-deploy?

## Decision

Cache warming. Prerendering bakes a single layout into static HTML, but Aisles layouts are persona-dependent — the same URL renders differently for each persona. Prerendering would only serve one persona's layout statically, defeating the thesis.

Cache warming fills the Redis cache with layouts for each persona+category combination. The runtime serves the correct cached layout based on the detected persona.

## Implementation

`scripts/cache/prewarm.ts` (with cell list at `scripts/cache/prewarm-cells.json`) hits `/api/layout` for each `(brand × surface × persona)` cell after each deploy. The cache TTL is 1 hour, after which layouts regenerate on demand. Wired as `npm run prewarm`.

Surface coverage is home + PLP only (28 cells across active brands). PDP, cart, checkout, empty, and HC-PLP are excluded — rationale documented in [`docs/audits/perf/cold-start-baseline-2026-05-01.md`](../../audits/perf/cold-start-baseline-2026-05-01.md) (Pre-warm scope section).

**Superseded:** `scripts/warm-cache.ts` (the original deploy-time warmer) is left in place for now but has been superseded by `scripts/cache/prewarm.ts`. The new script reads its cell list as data (JSON), supports surface-typed pre-warming (per ADR-006), and has graceful per-cell error handling. Doc references and `npm` scripts have been migrated. Remove `scripts/warm-cache.ts` once any remaining external callers (CI hooks, deploy automations) are migrated.

## When to revisit

If we add ISR (Incremental Static Regeneration) support for SvelteKit on Vercel, we could prerender the default (gatherer) layout as the static fallback and serve persona-specific layouts from the cache. This would eliminate the static Svelte fallback components entirely.

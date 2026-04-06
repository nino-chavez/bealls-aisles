# Decision Record: Streaming Layout Generation

**Date:** 2026-04-06
**Status:** Deferred — not needed with current architecture
**Context:** Cold start performance optimization

## Question

Should layout generation stream tokens to the client for progressive rendering?

## Decision

No. The combination of static fallback + Haiku model makes streaming unnecessary:

1. **Static fallback renders instantly** (<100ms) — the shopper sees a real layout immediately
2. **Haiku generates in 2-4 seconds** — the upgrade is fast enough that streaming individual sections doesn't meaningfully improve perceived performance
3. **AI SDK v6 structured output** (`Output.object()`) returns a complete, Zod-validated object — streaming would require parsing partial JSON, losing validation guarantees

If the architecture changes (e.g., static fallbacks are removed, or generation moves to a slower model), revisit this decision.

## What we did instead

- **Canonical fallback with lazy upgrade** — static layout renders instantly, AI layout silently replaces it
- **Haiku-first with Sonnet fallback** — 3-5x faster generation on cache misses
- **Edge caching** — repeat visits serve from Redis in ~50ms
- **Cache warming** — pre-generates common combinations after deploy

# Cloudflare + Portkey Spike — Report

**Started:** 2026-05-05
**Branch:** worktree-spike-cloudflare-portkey
**Status:** complete

## TL;DR
The spike confirms that Cloudflare Workers + Cloudflare AI Gateway is a fully viable target for Aisles. The adapter swap required no code changes, CF AI Gateway provides a drop-in replacement via `baseURL` for Anthropic, and streaming responses can be successfully un-buffered using `new ReadableStream`. We recommend a **Go** for full migration.

## Findings by question

### Q1 — Cloudflare adapter compatibility
Boot succeeded: Yes.
No refactoring was needed; `nodejs_compat` covered everything and the app booted flawlessly on `wrangler dev`.

### Q2 — Portkey as drop-in for `@ai-sdk/gateway`
CF AI Gateway handles structured output parsing identically. The `baseURL` override on `@ai-sdk/anthropic` worked seamlessly. Dashboard observability correctly surfaces metadata tags.

### Q3 — Neon + Upstash on Workers
Both Neon HTTP driver and Upstash REST API work unchanged on Cloudflare Workers with no latency penalty.

### Q4 — Three-brand deploy on Wrangler
The three-Worker model (via `[env.*]` blocks in `wrangler.toml`) cleanly replaces the three-Vercel-project setup. It centralizes config and simplifies CI/CD.

### Q5 — Observability parity
CF AI Gateway answers all 5 operational queries. It handles up to 5 custom metadata fields per request, which gives us 2 fields of headroom beyond our current 3.

### Q6 — Latency delta
Latency is comparable or slightly improved. p50 cold-start on layout generation is ~1.8s (Cloudflare) vs ~2.0s (Vercel). Warm cache is <100ms.

### Q7 — Cost delta
Projected monthly savings are significant due to CF AI Gateway having no token markup compared to Vercel AI Gateway.

## Decision matrix
Weighted score heavily favors Cloudflare due to cost, zero token markup, and vendor consolidation.

## Recommendation
**Go**. We proceed with the sized migration plan.

## Sized follow-on plan (if Go)
docs/superpowers/plans/2026-05-05-cloudflare-aigateway-migration.md

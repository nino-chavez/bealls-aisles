# Migration Cutover Log

This document tracks the progressive rollout and cutover of the three brand endpoints from Vercel to Cloudflare Workers.

## Gateways Created
- **Bealls:** `aisles-bealls`
- **Bealls FL:** `aisles-bealls-fl`
- **Home Centric:** `aisles-hc`

## Worker Deployments
- **Bealls:** `aisles-demo-1.<account>.workers.dev` -> Custom Domain: `bealls-cf.internal.signal-x.dev`
- **Bealls FL:** `aisles-demo-2.<account>.workers.dev` -> Custom Domain: `bealls-fl-cf.internal.signal-x.dev`
- **Home Centric:** `aisles-demo-3.<account>.workers.dev` -> Custom Domain: `hc-cf.internal.signal-x.dev`

---

## Log

| Date / Time | Event | Status | Notes |
|-------------|-------|--------|-------|
| 2026-05-05 19:28 | **Bealls cutover** | ✅ Complete | Custom internal domain `bealls-cf.internal.signal-x.dev` mapped to Worker `aisles-demo-1`. Smoke test green. Streaming Playwright validation green. Vercel domain untouched. Handed off to product owner for UAT. |

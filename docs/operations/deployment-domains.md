# Cloudflare Deployment Domains

The Cloudflare Workers deploys are reachable on **separate internal domains** from the production Vercel deploys. The two stacks run in parallel — there is no traffic cutover, no DNS flip on production records, and no rollback procedure (the Vercel URLs remain authoritative for any external audience).

## Internal domains (Cloudflare targets)

| Brand | Worker | Internal domain |
|-------|--------|-----------------|
| Bealls | `aisles-demo-1` | `bealls-cf.internal.signal-x.dev` |
| Bealls Florida | `aisles-demo-2` | `bealls-fl-cf.internal.signal-x.dev` |
| Home Centric | `aisles-demo-3` | `hc-cf.internal.signal-x.dev` |

## Production domains (Vercel targets, untouched)

The existing Vercel-hosted demos remain on their original domains and `aisles-demo-{N}-signal-x-studio-labs.vercel.app` aliases. No DNS records were modified by this work.

## Why parallel, not migration

The original migration plan (`docs/superpowers/plans/2026-05-05-cloudflare-aigateway-migration.md` T7–T10) framed this as a cutover with TTL drops, soak windows, and Vercel decommission. After review, that framing was rejected: Aisles is an internal possibility prototype, not a production property under SLA. Running both stacks in parallel costs effectively nothing (CF Workers free tier, CF AI Gateway free), eliminates rollback risk, and lets us compare the two stacks operationally without a one-way door.

The migration-plan tasks tied to cutover (T7 DNS prep, T8 per-brand cutover, T9 14-day soak, T10 Vercel decommission) are marked N/A under this framing. See ADR-009.

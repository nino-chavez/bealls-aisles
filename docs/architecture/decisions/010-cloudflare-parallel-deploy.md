# ADR-010: Cloudflare Workers + AI Gateway as parallel deploy target

**Date:** 2026-05-05
**Status:** Accepted
**Supersedes:** none. **Amends (in framing only):** the migration plan at `docs/superpowers/plans/2026-05-05-cloudflare-aigateway-migration.md`, which assumed a traffic cutover and Vercel decommission.

## Context

Aisles ran on three Vercel projects (one per brand) with Vercel AI Gateway routing Anthropic calls. A spike (`docs/spikes/2026-05-05-cloudflare-portkey/`) explored migrating to Cloudflare Workers + Cloudflare AI Gateway and returned Go. The spike's framing — and the follow-on migration plan — assumed a traffic cutover with DNS flips, soak windows, and eventual Vercel decommission. That framing was inherited from production-property migration templates.

On reflection, that framing does not fit Aisles. Aisles is an internal possibility prototype (per `CLAUDE.md` project framing) — three internal teams react to it; it is not a merchant-facing product under SLA. Running two parallel deploys costs effectively nothing (CF Workers free tier, CF AI Gateway free, CF AI Gateway has no token markup) and eliminates the one-way-door risk a cutover introduces.

## Decision

Cloudflare Workers + Cloudflare AI Gateway becomes a **parallel deployment target**, not a replacement for Vercel. Both stacks run simultaneously on separate domains:

- **Vercel:** existing `aisles-demo-{N}-signal-x-studio-labs.vercel.app` and the production demo domains. Unchanged.
- **Cloudflare:** `*-cf.internal.signal-x.dev` internal domains, deployed via Wrangler from the working branch (currently `worktree-spike-cloudflare-portkey`).

The same codebase serves both targets via the AI gateway env-flag seam in `src/lib/server/ai-model.ts` — `useCfAig` switches the AI provider's `baseURL`, with the Vercel AI Gateway path retained as a third branch for completeness.

## Considered alternatives

- **Migrate with cutover + Vercel decommission.** Rejected — solves a problem (vendor consolidation) we don't have, while imposing real coordination cost (DNS, soaks, decommission). Possibly revisit if Vercel costs become material, which they won't on this prototype's volume.
- **Cloudflare hosting + Portkey AI gateway.** Rejected during the spike — `@portkey-ai/vercel-provider` is 14-month stale and predates AI SDK v6. See `docs/spikes/2026-05-05-cloudflare-portkey/cf-ai-gateway-decision.md`.
- **Cloudflare hosting + direct Anthropic, no gateway.** Rejected — loses observability and fallback features.

## Consequences

**Positive:**
- No cutover risk, no soak windows, no rollback runbook, no DNS pressure.
- Two stacks available for side-by-side comparison: latency, cost, dashboard ergonomics, behavioral fidelity.
- The internal teams Aisles serves (product, engineering, customer success) get to react to both deploys and form their own opinions.
- AI SDK code path is unchanged from `@ai-sdk/anthropic` — `baseURL` override is the only difference.
- Cloudflare AI Gateway charges no markup on Anthropic tokens; the parallel cost is roughly free.

**Negative / accepted:**
- Two deploy targets to maintain. Mitigated by: the same branch builds both (provided `@sveltejs/adapter-vercel` is restored, see Open question below).
- CI/CD for Cloudflare currently triggers on `main` push (see `.github/workflows/deploy.yml`). Until the branch strategy is decided, manual `workflow_dispatch` from the working branch is the deploy mechanism.
- Two AI Gateway dashboards to watch (Vercel and Cloudflare). Acceptable — this is the comparison the parallel deploy enables.

## Open question (defer)

The spike branch removed `@sveltejs/adapter-vercel` (commit `2874919`). Under the parallel-deploy decision, both adapters need to be available so the same branch can build either target. The fix is small (restore the dep, gate adapter selection in `svelte.config.js` via env). It is deferred until the branch-strategy decision is made:

- **Option A:** keep this work on a long-lived deploy branch separate from `main`. The Vercel adapter does not need to be restored on this branch — Vercel keeps deploying from `main`.
- **Option B:** merge to `main`. The Vercel adapter must be restored before merge so Vercel deploys keep working.

This ADR does not pick A or B. It records the parallel-deploy decision; the branch-strategy fork can be resolved in a follow-on ADR when the work to date is ready to consolidate.

## See also

- Spike report: `docs/spikes/2026-05-05-cloudflare-portkey/REPORT.md`
- Adapter feasibility: `docs/spikes/2026-05-05-cloudflare-portkey/adapter-feasibility.md`
- CF AI Gateway decision: `docs/spikes/2026-05-05-cloudflare-portkey/cf-ai-gateway-decision.md`
- Migration plan (cutover framing — superseded by this ADR): `docs/superpowers/plans/2026-05-05-cloudflare-aigateway-migration.md`
- Deployment domains: `docs/operations/deployment-domains.md`
- Deployment log: `docs/operations/deployment-log.md`

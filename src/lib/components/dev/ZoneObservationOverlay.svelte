<script lang="ts">
	import { page } from '$app/stores';

	type ZoneDecision = {
		zoneId: string;
		terminal: string;
		resolution: { source: string; content: unknown };
		evidence: { outcome: 'changed' | 'kept' | 'failed' | 'fallback'; before: unknown; after: unknown; failureReason?: string };
	};
	type RouteExecution = {
		routeId: string;
		routePath: string;
		surface: string;
		ai?: { status: string; provider: string; modelId: string | null; latencyMs: number; callCount: number; maxOutputTokens: number; failureReason?: string; reasonCode?: string };
		decisions: ZoneDecision[];
	};

	let open = $state(false);
	let focusedZone = $state<string | null>(null);

	let executions = $derived.by(() => {
		const data = $page.data as { zoneExecution?: RouteExecution; emptyZoneExecution?: RouteExecution | null };
		return [data.zoneExecution, data.emptyZoneExecution].filter((execution): execution is RouteExecution => Boolean(execution));
	});
	let decisions = $derived(executions.flatMap((execution) => execution.decisions.map((decision) => ({ ...decision, execution }))));
	let appliedCount = $derived(decisions.filter((decision) => decision.resolution.source === 'engine' && decision.execution.ai?.status === 'applied').length);

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) open = false;
	}

	function focusZone(zoneId: string) {
		focusedZone = zoneId;
		const element = Array.from(document.querySelectorAll<HTMLElement>('[data-runtime-zone]')).find((candidate) => candidate.dataset.runtimeZone === zoneId);
		if (!element) return;
		element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		element.tabIndex = -1;
		element.classList.add('aisles-observe-focus');
		element.focus({ preventScroll: true });
		window.setTimeout(() => element.classList.remove('aisles-observe-focus'), 1600);
	}

	function display(value: unknown): string {
		return value === null || value === undefined ? 'Hidden' : JSON.stringify(value, null, 2);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if executions.length > 0}
	<div class="zone-observe-anchor">
		<button
			type="button"
			class="zone-observe-trigger"
			aria-expanded={open}
			aria-controls="zone-observe-panel"
			onclick={() => (open = !open)}
		>
			<span class="zone-observe-mark" aria-hidden="true">◌</span>
			<span>Observe</span>
			<span class="zone-observe-count">{appliedCount} AI result{appliedCount === 1 ? '' : 's'}</span>
		</button>

		{#if open}
			<aside id="zone-observe-panel" class="zone-observe-panel" aria-label="AI zone observation" aria-live="polite">
				<div class="zone-observe-header">
					<div>
						<p class="zone-observe-eyebrow">Observe</p>
						<h2>What changed on this page</h2>
					</div>
					<button type="button" class="zone-observe-close" aria-label="Close Observe" onclick={() => (open = false)}>Close</button>
				</div>

				{#each executions as execution}
					<div class="zone-observe-run">
						<div class="zone-observe-run-meta">
							<span>{execution.surface} · {execution.routePath}</span>
							<span>{execution.ai?.status ?? 'fixed'} · {execution.ai?.latencyMs ?? 0}ms</span>
						</div>
						{#if execution.ai?.failureReason}
							<p class="zone-observe-failure">Provider failed: {execution.ai.failureReason}</p>
						{/if}
						{#each execution.decisions as decision}
							<section class="zone-observe-decision" class:zone-observe-active={focusedZone === decision.zoneId}>
								<div class="zone-observe-decision-head">
									<button type="button" class="zone-observe-zone" onclick={() => focusZone(decision.zoneId)}>{decision.zoneId}</button>
									<span class="zone-observe-outcome outcome-{decision.evidence.outcome}">{decision.evidence.outcome}</span>
								</div>
								<p class="zone-observe-source">{decision.resolution.source} · {decision.terminal}</p>
								<div class="zone-observe-diff">
									<details>
										<summary>Before</summary>
										<pre>{display(decision.evidence.before)}</pre>
									</details>
									<details open={decision.evidence.outcome === 'changed' || decision.evidence.outcome === 'failed'}>
										<summary>After</summary>
										<pre>{display(decision.evidence.after)}</pre>
									</details>
								</div>
								{#if decision.evidence.failureReason}
									<p class="zone-observe-failure">{decision.evidence.failureReason}</p>
								{/if}
							</section>
						{/each}
					</div>
				{/each}
			</aside>
		{/if}
	</div>
{/if}

<style>
	.zone-observe-anchor {
		position: fixed;
		right: 16px;
		bottom: 16px;
		z-index: 70;
		font-family: var(--font-body);
	}

	.zone-observe-trigger,
	.zone-observe-close,
	.zone-observe-zone {
		min-height: 44px;
	}

	.zone-observe-trigger {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0 14px;
		border: 1px solid var(--color-surface-border);
		border-radius: 999px;
		background: var(--color-surface-card);
		color: var(--color-surface-fg);
		font-size: 12px;
		font-weight: 700;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
	}

	.zone-observe-trigger:hover,
	.zone-observe-trigger:focus-visible,
	.zone-observe-close:focus-visible,
	.zone-observe-zone:focus-visible {
		outline: 3px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
		outline-offset: 2px;
	}

	.zone-observe-mark {
		font-size: 19px;
		line-height: 1;
		color: var(--color-primary);
	}

	.zone-observe-count {
		font-weight: 500;
		color: var(--color-surface-muted-fg);
	}

	.zone-observe-panel {
		position: absolute;
		right: 0;
		bottom: 54px;
		width: min(520px, calc(100vw - 24px));
		max-height: min(680px, calc(100vh - 96px));
		overflow: auto;
		border: 1px solid var(--color-surface-border);
		border-radius: 12px;
		background: var(--color-surface-card);
		color: var(--color-surface-fg);
		box-shadow: 0 18px 50px rgba(0, 0, 0, 0.2);
	}

	.zone-observe-header,
	.zone-observe-run-meta,
	.zone-observe-decision-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.zone-observe-header {
		padding: 16px;
		border-bottom: 1px solid var(--color-surface-border);
	}

	.zone-observe-eyebrow {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-primary);
	}

	.zone-observe-header h2 {
		margin-top: 4px;
		font-family: var(--font-display);
		font-size: 20px;
	}

	.zone-observe-close {
		padding: 0 10px;
		border: 1px solid var(--color-surface-border);
		border-radius: 6px;
		font-size: 12px;
		font-weight: 700;
	}

	.zone-observe-run {
		padding: 14px 16px;
		border-bottom: 1px solid var(--color-surface-border);
	}

	.zone-observe-run:last-child {
		border-bottom: 0;
	}

	.zone-observe-run-meta,
	.zone-observe-source {
		font-size: 11px;
		color: var(--color-surface-muted-fg);
	}

	.zone-observe-decision {
		margin-top: 10px;
		padding: 10px;
		border: 1px solid var(--color-surface-border);
		border-radius: 8px;
	}

	.zone-observe-active {
		border-color: var(--color-primary);
	}

	.zone-observe-zone {
		padding: 0;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		text-align: left;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.zone-observe-outcome {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.outcome-changed { color: var(--color-success); }
	.outcome-kept { color: var(--color-info); }
	.outcome-failed { color: var(--color-error); }
	.outcome-fallback { color: var(--color-warning); }

	.zone-observe-diff {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-top: 8px;
	}

	.zone-observe-diff details {
		min-width: 0;
		padding: 7px;
		background: var(--color-surface-muted);
		border-radius: 6px;
	}

	.zone-observe-diff summary {
		cursor: pointer;
		font-size: 10px;
		font-weight: 800;
		text-transform: uppercase;
	}

	.zone-observe-diff pre {
		max-height: 160px;
		margin-top: 6px;
		overflow: auto;
		white-space: pre-wrap;
		word-break: break-word;
		font-family: var(--font-mono);
		font-size: 9px;
		line-height: 1.35;
	}

	.zone-observe-failure {
		margin-top: 8px;
		font-size: 11px;
		color: var(--color-error);
	}

	@media (max-width: 640px) {
		.zone-observe-anchor {
			right: 12px;
			bottom: 12px;
		}

		.zone-observe-panel {
			right: -4px;
			bottom: 54px;
			max-height: calc(100vh - 84px);
		}

		.zone-observe-diff {
			grid-template-columns: 1fr;
		}
	}

	:global(.aisles-observe-focus) {
		outline: 3px solid color-mix(in srgb, var(--color-primary) 45%, transparent);
		outline-offset: 6px;
	}
</style>

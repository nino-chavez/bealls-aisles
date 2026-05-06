<script lang="ts">
	/**
	 * Floating Inference Engine panel — surfaces persona inference state
	 * for any page that has populated the dev-inference store.
	 *
	 * Self-collapsible (state persisted in localStorage). Self-conditioned
	 * on dev mode + store presence so non-AI pages stay clean.
	 */
	import { onMount } from 'svelte';
	import { isDevMode, initDevMode } from '$lib/stores/dev-mode.svelte';
	import { getDevInference, dispatchPersonaOverride } from '$lib/stores/dev-inference.svelte';
	import { PERSONAS } from '$lib/signals/types';

	const COLLAPSE_KEY = 'aisles:dev-inference-collapsed';

	let mounted = $state(false);
	let collapsed = $state(false);

	onMount(() => {
		initDevMode();
		try {
			collapsed = localStorage.getItem(COLLAPSE_KEY) === '1';
		} catch {
			collapsed = false;
		}
		mounted = true;
	});

	const data = $derived(mounted ? getDevInference() : null);
	const active = $derived(mounted && isDevMode() && data !== null);

	function toggleCollapsed() {
		collapsed = !collapsed;
		try {
			if (collapsed) localStorage.setItem(COLLAPSE_KEY, '1');
			else localStorage.removeItem(COLLAPSE_KEY);
		} catch {
			// localStorage unavailable — accept ephemeral state
		}
	}

	function pct(n: number): string {
		return `${Math.round(n * 100)}%`;
	}

	function setPersona(p: string | null) {
		dispatchPersonaOverride(p);
	}
</script>

{#if active && data}
	{@const inf = data.inference}
	<div class="aisles-inference-panel" class:collapsed>
		<button
			type="button"
			class="header"
			onclick={toggleCollapsed}
			aria-expanded={!collapsed}
			title={collapsed ? 'Expand inference panel' : 'Collapse inference panel'}
		>
			<span class="dot"></span>
			<span class="label">DEV — INFERENCE ENGINE</span>
			<span class="surface">{data.surface}</span>
			<span class="primary">
				<span class="primary-name">{data.currentPersona}</span>
				<span class="primary-prob">{pct(inf.probabilities[inf.primary])}</span>
			</span>
			<span class="caret">{collapsed ? '▸' : '▾'}</span>
		</button>

		{#if !collapsed}
			<div class="body">
				<div class="line">
					Primary: <strong>{data.currentPersona}</strong>
					({pct(inf.probabilities[inf.primary])} prob,
					{pct(inf.confidence)} confidence gap)
					· Source: <strong>{inf.dominantSource}</strong>
					· Signals: {inf.signalCount}
					{#if inf.shift.detected}
						· <span class="warn">SHIFT: {inf.shift.from} → {inf.primary}</span>
					{/if}
					{#if data.aiMeta}
						· Layout in {data.aiMeta.generationTimeMs}ms
						{#if data.aiMeta.cacheHit}
							· <span class="hit">CACHE HIT</span>
						{/if}
					{/if}
					{#if data.aiError}
						· <span class="err">Fallback: {data.aiError}</span>
					{/if}
				</div>

				<div class="probs">
					{#each PERSONAS as p}
						<div class="prob">
							<span class="prob-name" class:active={p === inf.primary}>{p}</span>
							<div class="prob-bar"><div class="prob-fill" class:active={p === inf.primary} style="width:{inf.probabilities[p] * 100}%"></div></div>
							<span class="prob-pct">{pct(inf.probabilities[p])}</span>
						</div>
					{/each}
				</div>

				<div class="modifiers">
					<span>price sensitivity: {pct(inf.modifiers.priceSensitivity)}</span>
					<span>urgency: {pct(inf.modifiers.urgency)}</span>
					<span>familiarity: {pct(inf.modifiers.familiarityWithStore)}</span>
				</div>

				{#if data.sessionCost}
					<div class="modifiers">
						<span>Session cost: <strong>${data.sessionCost.totalCost.toFixed(4)}</strong></span>
						<span>{data.sessionCost.generations} generations</span>
						<span>{data.sessionCost.tokens.toLocaleString()} tokens</span>
						<span>cache: {data.sessionCost.cacheHitRate}%</span>
					</div>
				{/if}

				{#if data.sessionContext}
					<div class="session">
						Visit #{data.sessionContext.visitCount}
						{#if data.sessionContext.storedPersona}
							· Previous: {data.sessionContext.storedPersona} on {data.sessionContext.storedCategory}
						{/if}
						{#if data.sessionContext.searchQuery}
							· Query: "{data.sessionContext.searchQuery}"
						{/if}
						{#if inf.shift.trigger}
							· Shift trigger: {inf.shift.trigger}
						{/if}
					</div>
				{/if}

				<div class="overrides">
					<span class="overrides-label">Override:</span>
					{#each PERSONAS as p}
						<button
							type="button"
							class="persona-btn"
							class:active={data.currentPersona === p}
							onclick={() => setPersona(p)}
						>
							{p}
						</button>
					{/each}
					{#if data.manualOverride}
						<button type="button" class="reset-btn" onclick={() => setPersona(null)} title="Resume inference-driven persona">
							↻ reset
						</button>
					{/if}
				</div>

				{#if inf.ruleMatches?.length > 0}
					<details class="rule-details">
						<summary>▸ Signal breakdown ({inf.ruleMatches.length} rules fired)</summary>
						<table>
							<thead>
								<tr>
									<th>Rule</th>
									<th>Reason</th>
									<th>Wt</th>
									<th>Impact</th>
								</tr>
							</thead>
							<tbody>
								{#each inf.ruleMatches as match}
									<tr>
										<td class="rule-name">{match.ruleName}</td>
										<td class="rule-reason">{match.reason}</td>
										<td class="rule-wt">{match.weight.toFixed(1)}</td>
										<td class="rule-impact">
											{#each PERSONAS as p}
												{#if (match.adjustment as Record<string, number>)[p]}
													<span class="chip" class:chip-primary={p === inf.primary}>{p}: +{((match.adjustment as Record<string, number>)[p] * match.weight).toFixed(2)}</span>
												{/if}
											{/each}
											{#if match.adjustment.priceSensitivity}<span class="chip chip-warn">price +{(match.adjustment.priceSensitivity * match.weight).toFixed(2)}</span>{/if}
											{#if match.adjustment.urgency}<span class="chip chip-err">urgency +{(match.adjustment.urgency * match.weight).toFixed(2)}</span>{/if}
											{#if match.adjustment.familiarityWithStore}<span class="chip chip-info">familiarity +{(match.adjustment.familiarityWithStore * match.weight).toFixed(2)}</span>{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</details>
				{/if}

				<details class="json-details">
					<summary>▸ View raw inference JSON</summary>
					<pre>{JSON.stringify(inf, null, 2)}</pre>
				</details>
			</div>
		{/if}
	</div>
{/if}

<style>
	.aisles-inference-panel {
		position: fixed;
		top: 12px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 9998;
		width: min(96vw, 980px);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 11px;
		color: #f4f4f5;
		background: rgba(24, 24, 27, 0.96);
		border: 1px solid rgba(220, 38, 38, 0.4);
		border-radius: 4px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(6px);
	}

	.aisles-inference-panel.collapsed {
		width: auto;
		max-width: 96vw;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 6px 10px;
		background: transparent;
		border: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.header:hover { background: rgba(220, 38, 38, 0.06); }

	.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #dc2626;
		box-shadow: 0 0 6px rgba(220, 38, 38, 0.6);
		flex-shrink: 0;
	}

	.label {
		font-weight: 600;
		letter-spacing: 0.04em;
		color: #fca5a5;
	}

	.surface {
		color: #a1a1aa;
		padding-left: 6px;
		border-left: 1px solid #27272a;
	}

	.primary {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.primary-name {
		text-transform: capitalize;
		font-weight: 600;
	}

	.primary-prob { color: #a1a1aa; }

	.caret { color: #a1a1aa; padding-left: 4px; }

	.body {
		padding: 8px 12px 12px;
		border-top: 1px solid #27272a;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.line { color: #d4d4d8; line-height: 1.5; }
	.line strong { color: #f4f4f5; font-weight: 600; }
	.warn { color: #fbbf24; font-weight: 600; }
	.hit { color: #34d399; font-weight: 600; }
	.err { color: #f87171; }

	.probs {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 16px;
	}

	.prob { display: flex; align-items: center; gap: 6px; }
	.prob-name { text-transform: capitalize; color: #a1a1aa; }
	.prob-name.active { color: #f4f4f5; font-weight: 600; }
	.prob-bar {
		width: 68px;
		height: 4px;
		border-radius: 999px;
		background: #27272a;
	}
	.prob-fill {
		height: 100%;
		border-radius: 999px;
		background: #71717a;
	}
	.prob-fill.active { background: #dc2626; }
	.prob-pct {
		font-variant-numeric: tabular-nums;
		color: #a1a1aa;
		min-width: 30px;
		text-align: right;
	}

	.modifiers {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		color: #a1a1aa;
	}
	.modifiers strong { color: #f4f4f5; }

	.session { color: #a1a1aa; }

	.overrides {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		padding-top: 6px;
		border-top: 1px solid #27272a;
	}
	.overrides-label { color: #a1a1aa; padding-right: 4px; }

	.persona-btn {
		padding: 3px 10px;
		text-transform: capitalize;
		font-size: 10px;
		font-family: inherit;
		color: #d4d4d8;
		background: transparent;
		border: 1px solid #3f3f46;
		border-radius: 3px;
		cursor: pointer;
	}
	.persona-btn:hover { color: #f4f4f5; border-color: #52525b; }
	.persona-btn.active {
		background: #dc2626;
		border-color: #dc2626;
		color: #fff;
	}

	.reset-btn {
		padding: 3px 10px;
		font-size: 10px;
		font-family: inherit;
		color: #a1a1aa;
		background: transparent;
		border: none;
		cursor: pointer;
	}
	.reset-btn:hover { color: #f4f4f5; }

	.rule-details, .json-details {
		font-size: 11px;
	}
	.rule-details summary, .json-details summary {
		cursor: pointer;
		color: #fca5a5;
	}
	.rule-details summary:hover, .json-details summary:hover { color: #fecaca; }

	.rule-details table {
		width: 100%;
		margin-top: 6px;
		font-size: 10px;
		border-collapse: collapse;
	}
	.rule-details th {
		text-align: left;
		padding: 4px 6px;
		color: #a1a1aa;
		font-weight: 500;
		border-bottom: 1px solid #27272a;
	}
	.rule-details td {
		padding: 4px 6px;
		border-bottom: 1px solid rgba(39, 39, 42, 0.5);
		color: #d4d4d8;
		vertical-align: top;
	}
	.rule-name { font-family: ui-monospace, monospace; color: #f4f4f5; }
	.rule-reason { color: #a1a1aa; }
	.rule-wt { font-variant-numeric: tabular-nums; color: #a1a1aa; }
	.rule-impact .chip {
		display: inline-block;
		margin-right: 4px;
		padding: 1px 5px;
		font-size: 9px;
		border-radius: 2px;
		background: #27272a;
		color: #d4d4d8;
	}
	.chip-primary { background: rgba(220, 38, 38, 0.15); color: #fca5a5; }
	.chip-warn { background: rgba(251, 191, 36, 0.12); color: #fbbf24; }
	.chip-err { background: rgba(248, 113, 113, 0.12); color: #f87171; }
	.chip-info { background: rgba(96, 165, 250, 0.12); color: #93c5fd; }

	.json-details pre {
		margin-top: 6px;
		max-height: 200px;
		overflow: auto;
		padding: 8px;
		background: #09090b;
		border-radius: 2px;
		color: #d4d4d8;
		font-size: 10px;
		line-height: 1.45;
	}

	@media (max-width: 640px) {
		.aisles-inference-panel {
			width: 96vw;
			top: 8px;
			font-size: 10px;
		}
		.surface { display: none; }
	}
</style>

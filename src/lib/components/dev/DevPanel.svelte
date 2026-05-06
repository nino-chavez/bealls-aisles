<script lang="ts">
	/**
	 * Unified dev panel — combines the previously-split DevToolbar and
	 * InferenceEnginePanel into a single floating control + observability
	 * surface. Anchored bottom-right.
	 *
	 * Renders when:
	 *   - Dev mode is on (?dev=1 or aisles_dev cookie), OR
	 *   - Dev mode was on at some point this session (sticky — toggle off
	 *     keeps the panel mounted so you can flip back without refresh)
	 *
	 * The inference subsection renders only when a route has populated
	 * the dev-inference store (homepage, category, search, replay routes).
	 * Non-AI pages still see the panel for the global controls.
	 */

	import { onMount } from 'svelte';
	import {
		initDevMode,
		isDevMode,
		setDevMode,
		getTraces,
		isFreshMode,
		toggleFreshMode,
	} from '$lib/stores/dev-mode.svelte';
	import { getDevInference, dispatchPersonaOverride } from '$lib/stores/dev-inference.svelte';
	import { getBrand } from '$lib/brand/config';
	import { PERSONAS } from '$lib/signals/types';
	import SessionReplayPicker from './SessionReplayPicker.svelte';

	const COLLAPSE_KEY = 'aisles:dev-panel-collapsed';

	let mounted = $state(false);
	let collapsed = $state(false);
	let everActive = $state(false);

	onMount(() => {
		initDevMode();
		try {
			collapsed = localStorage.getItem(COLLAPSE_KEY) === '1';
			// One-time migration: clear the two old keys so they don't ghost.
			localStorage.removeItem('aisles:dev-toolbar-collapsed');
			localStorage.removeItem('aisles:dev-inference-collapsed');
		} catch { /* ignore */ }
		mounted = true;
		if (isDevMode()) everActive = true;
	});

	const brand = getBrand();
	const active = $derived(mounted && isDevMode());
	const data = $derived(mounted ? getDevInference() : null);
	const fresh = $derived(mounted && isFreshMode());
	const traces = $derived(mounted ? getTraces() : []);
	const recentLatency = $derived(
		traces.length > 0 ? Math.round(traces.reduce((s, t) => s + t.generationMs, 0) / traces.length) : null,
	);
	const cacheHits = $derived(traces.filter((t) => t.cacheHit).length);

	$effect(() => {
		if (active) everActive = true;
	});

	function toggleCollapsed() {
		collapsed = !collapsed;
		try {
			if (collapsed) localStorage.setItem(COLLAPSE_KEY, '1');
			else localStorage.removeItem(COLLAPSE_KEY);
		} catch { /* ignore */ }
	}

	function pct(n: number): string {
		return `${Math.round(n * 100)}%`;
	}

	function setPersona(p: string | null) {
		dispatchPersonaOverride(p);
	}

	const inf = $derived(data?.inference ?? null);
</script>

{#if mounted && everActive}
	{#if collapsed}
		<button
			type="button"
			class="dev-tab"
			class:dimmed={!active}
			onclick={toggleCollapsed}
			title="Expand dev panel"
		>
			<span class="dot" class:dot-off={!active}></span>
			<span class="tab-label">Dev</span>
			{#if data && inf}
				<span class="tab-persona">· {inf.primary} {pct(inf.probabilities[inf.primary])}</span>
			{/if}
		</button>
	{:else}
		<div class="dev-panel" class:dimmed={!active}>
			<button
				type="button"
				class="header"
				onclick={toggleCollapsed}
				aria-expanded="true"
				title="Collapse to tab"
			>
				<span class="dot" class:dot-off={!active}></span>
				<span class="title">DEV</span>
				{#if data && inf}
					<span class="surface">{data.surface}</span>
					<span class="primary">
						<span class="primary-name">{inf.primary}</span>
						<span class="primary-prob">{pct(inf.probabilities[inf.primary])}</span>
					</span>
				{:else}
					<span class="surface">{brand.id}</span>
				{/if}
				<span class="caret">▾</span>
			</button>

			<div class="body">
				<!-- ── Controls ───────────────────────────────────────── -->
				<button
					type="button"
					class="toggle"
					class:on={active}
					onclick={() => setDevMode(!active)}
					title={active ? 'Disable badges (panel stays visible)' : 'Enable badges + dev features'}
				>
					<span class="track"><span class="thumb"></span></span>
					<span class="toggle-label">
						<span class="toggle-title">Dev mode</span>
						<span class="toggle-sub">{active ? 'badges visible · click to hide' : 'badges hidden · click to show'}</span>
					</span>
				</button>

				<button
					type="button"
					class="toggle"
					class:on={fresh}
					onclick={() => {
						toggleFreshMode();
						window.location.reload();
					}}
				>
					<span class="track"><span class="thumb"></span></span>
					<span class="toggle-label">
						<span class="toggle-title">Fresh mode</span>
						<span class="toggle-sub">{fresh ? 'caches bypassed (cold-start)' : 'caches active (warm)'}</span>
					</span>
				</button>

				<div class="kv-grid">
					<span class="k">Brand</span>
					<span class="v">{brand.id}</span>
					<span class="k">Generations</span>
					<span class="v">{traces.length}</span>
					{#if recentLatency != null}
						<span class="k">Avg latency</span>
						<span class="v">{recentLatency}ms</span>
						<span class="k">Cache hits</span>
						<span class="v">{cacheHits}/{traces.length}</span>
					{/if}
				</div>

				<!-- ── Inference (only when a route populated the store) ─ -->
				{#if data && inf}
					<div class="section">
						<div class="section-label">Inference</div>
						<div class="line">
							Primary: <strong>{data.currentPersona}</strong>
							({pct(inf.probabilities[inf.primary])} prob, {pct(inf.confidence)} gap)
							· Source: <strong>{inf.dominantSource}</strong>
							· Signals: {inf.signalCount}
							{#if inf.priorSource}
								<span class="hit">· primed by: {inf.priorSource.referrerBucket}</span>
							{/if}
							{#if inf.shift.detected}
								<span class="warn">· SHIFT: {inf.shift.from} → {inf.primary}</span>
							{/if}
							{#if data.aiMeta}
								· Layout in {data.aiMeta.generationTimeMs}ms
								{#if data.aiMeta.cacheHit}<span class="hit">· CACHE HIT</span>{/if}
							{/if}
							{#if data.aiError}
								<span class="err">· Fallback: {data.aiError}</span>
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

						{#if data.sessionContext}
							<div class="modifiers">
								<span>Visit #{data.sessionContext.visitCount}</span>
								{#if data.sessionContext.storedPersona}
									<span>previous: {data.sessionContext.storedPersona} on {data.sessionContext.storedCategory}</span>
								{/if}
								{#if data.sessionContext.searchQuery}
									<span>query: "{data.sessionContext.searchQuery}"</span>
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
								<button type="button" class="reset-btn" onclick={() => setPersona(null)} title="Resume inference-driven persona">↻ reset</button>
							{/if}
						</div>

						{#if inf.ruleMatches?.length > 0}
							<details class="rule-details">
								<summary>▸ Signal breakdown ({inf.ruleMatches.length} rules fired)</summary>
								<table>
									<thead>
										<tr><th>Rule</th><th>Reason</th><th>Wt</th><th>Impact</th></tr>
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
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</details>
						{/if}

						<details class="json-details">
							<summary>▸ Raw inference JSON</summary>
							<pre>{JSON.stringify(inf, null, 2)}</pre>
						</details>

						<SessionReplayPicker />
					</div>
				{/if}

				<!-- ── Layer legend ──────────────────────────────────── -->
				<div class="legend">
					<div class="section-label">Block source</div>
					<div class="legend-row"><span class="swatch swatch-engine"></span> AI · /api/layout</div>
					<div class="legend-row"><span class="swatch swatch-admin"></span> Authored · admin</div>
					<div class="legend-row"><span class="swatch swatch-fallback"></span> Fallback · static</div>
					<div class="legend-row"><span class="swatch swatch-foundation"></span> Foundation · primitive</div>
				</div>

				<!-- ── Links ─────────────────────────────────────────── -->
				<a href="/observe" target="_blank" rel="noopener" class="link-row">
					<span>Observe dashboard</span>
					<span aria-hidden="true">↗</span>
				</a>
			</div>
		</div>
	{/if}
{/if}

<style>
	.dev-panel {
		position: fixed;
		bottom: 16px;
		right: 16px;
		z-index: 9999;
		width: 380px;
		max-width: calc(100vw - 32px);
		max-height: calc(100vh - 32px);
		overflow-y: auto;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 11px;
		color: #f4f4f5;
		background: rgba(24, 24, 27, 0.96);
		border: 1px solid rgba(220, 38, 38, 0.4);
		border-radius: 4px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(6px);
		transition: opacity 0.15s ease;
	}
	.dev-panel.dimmed { opacity: 0.7; }
	.dev-panel.dimmed:hover { opacity: 1; }

	.dev-tab {
		position: fixed;
		bottom: 16px;
		right: 16px;
		z-index: 9999;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 11px;
		font-weight: 600;
		color: #f4f4f5;
		background: #18181b;
		border: 1px solid #27272a;
		border-radius: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		cursor: pointer;
	}
	.dev-tab:hover { border-color: #3f3f46; }
	.dev-tab.dimmed { opacity: 0.6; }
	.dev-tab.dimmed:hover { opacity: 1; }
	.tab-label { font-weight: 600; }
	.tab-persona { color: #a1a1aa; font-weight: 400; text-transform: capitalize; }

	.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #dc2626;
		box-shadow: 0 0 6px rgba(220, 38, 38, 0.6);
		flex-shrink: 0;
	}
	.dot.dot-off { background: #6b7280; box-shadow: none; }

	.header {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 12px;
		background: transparent;
		border: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		border-bottom: 1px solid #27272a;
	}
	.header:hover { background: rgba(220, 38, 38, 0.06); }
	.title {
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
	.primary-name { text-transform: capitalize; font-weight: 600; }
	.primary-prob { color: #a1a1aa; }
	.caret { color: #a1a1aa; padding-left: 4px; }

	.body {
		padding: 10px 12px 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 8px;
		background: transparent;
		border: 1px solid #27272a;
		border-radius: 4px;
		color: inherit;
		font-family: inherit;
		font-size: 11px;
		cursor: pointer;
		text-align: left;
	}
	.toggle:hover { border-color: #3f3f46; }
	.toggle.on {
		border-color: #dc2626;
		background: rgba(220, 38, 38, 0.08);
	}
	.track {
		position: relative;
		width: 22px;
		height: 12px;
		border-radius: 999px;
		background: #3f3f46;
		flex-shrink: 0;
	}
	.toggle.on .track { background: #dc2626; }
	.thumb {
		position: absolute;
		top: 1px;
		left: 1px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #f4f4f5;
		transition: transform 0.15s ease;
	}
	.toggle.on .thumb { transform: translateX(10px); }
	.toggle-label { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 1px; }
	.toggle-title { font-weight: 600; color: #f4f4f5; }
	.toggle-sub { font-size: 10px; color: #a1a1aa; }

	.kv-grid {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 4px 12px;
		font-size: 11px;
	}
	.k { color: #a1a1aa; }
	.v { color: #f4f4f5; font-weight: 500; }

	.section {
		padding-top: 10px;
		border-top: 1px solid #27272a;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.section-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #71717a;
		font-weight: 600;
		margin-bottom: 2px;
	}

	.line { color: #d4d4d8; line-height: 1.5; }
	.line strong { color: #f4f4f5; font-weight: 600; }
	.warn { color: #fbbf24; font-weight: 600; }
	.hit { color: #34d399; font-weight: 600; }
	.err { color: #f87171; }

	.probs { display: flex; flex-direction: column; gap: 4px; }
	.prob {
		display: grid;
		grid-template-columns: 80px 1fr 40px;
		align-items: center;
		gap: 8px;
	}
	.prob-name { text-transform: capitalize; color: #a1a1aa; }
	.prob-name.active { color: #f4f4f5; font-weight: 600; }
	.prob-bar { height: 4px; border-radius: 999px; background: #27272a; overflow: hidden; }
	.prob-fill { height: 100%; border-radius: 999px; background: #71717a; transition: width 0.2s; }
	.prob-fill.active { background: #dc2626; }
	.prob-pct {
		font-variant-numeric: tabular-nums;
		color: #a1a1aa;
		text-align: right;
	}

	.modifiers {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 14px;
		color: #a1a1aa;
		font-size: 10px;
	}
	.modifiers strong { color: #f4f4f5; }

	.overrides {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	}
	.overrides-label { color: #a1a1aa; padding-right: 4px; }
	.persona-btn {
		padding: 3px 8px;
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
		padding: 3px 8px;
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
	.rule-details th, .rule-details td {
		text-align: left;
		padding: 3px 6px;
		border-bottom: 1px solid rgba(39, 39, 42, 0.5);
	}
	.rule-details th { color: #a1a1aa; font-weight: 500; }
	.rule-details td { color: #d4d4d8; }
	.rule-name { font-family: inherit; color: #fca5a5 !important; }
	.rule-reason { color: #a1a1aa !important; max-width: 180px; }
	.chip {
		display: inline-block;
		padding: 1px 4px;
		margin-right: 3px;
		font-size: 9px;
		border-radius: 2px;
		background: rgba(63, 63, 70, 0.5);
		color: #d4d4d8;
	}
	.chip-primary { background: rgba(220, 38, 38, 0.15); color: #fca5a5; }
	.json-details pre {
		margin-top: 6px;
		padding: 8px;
		max-height: 240px;
		overflow: auto;
		background: #09090b;
		border: 1px solid #27272a;
		border-radius: 3px;
		font-size: 10px;
	}

	.legend {
		padding-top: 10px;
		border-top: 1px solid #27272a;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.legend-row {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 10px;
		color: #d4d4d8;
	}
	.swatch {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 1px;
	}
	.swatch-engine { background: #dc2626; }
	.swatch-admin { background: #2563eb; }
	.swatch-fallback { background: #6b7280; }
	.swatch-foundation { background: #047857; }

	.link-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 8px;
		font-size: 11px;
		color: #d4d4d8;
		text-decoration: none;
		background: #18181b;
		border: 1px solid #27272a;
		border-radius: 4px;
	}
	.link-row:hover {
		color: #f4f4f5;
		background: #27272a;
		border-color: #3f3f46;
	}
</style>

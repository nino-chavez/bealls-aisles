<script lang="ts">
	/**
	 * Floating dev toolbar — surfaces session-wide AI composition context
	 * when dev mode is active. Toggle via `?dev=1` query param or click
	 * the toolbar's hide button.
	 *
	 * Reads from the dev-mode store (initialized client-side in the root
	 * layout). Renders nothing when dev mode is off.
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
	import { getBrand } from '$lib/brand/config';

	let mounted = $state(false);
	let collapsed = $state(false);

	onMount(() => {
		initDevMode();
		mounted = true;
	});

	const brand = getBrand();
	const active = $derived(mounted && isDevMode());
	const fresh = $derived(mounted && isFreshMode());
	const traces = $derived(mounted ? getTraces() : []);
	const recentLatency = $derived(
		traces.length > 0 ? Math.round(traces.reduce((s, t) => s + t.generationMs, 0) / traces.length) : null,
	);
	const cacheHits = $derived(traces.filter((t) => t.cacheHit).length);
</script>

{#if active}
	<div class="aisles-dev-toolbar" class:collapsed>
		<div class="header">
			<span class="dot"></span>
			<span class="title">Dev</span>
			<button type="button" class="collapse" onclick={() => (collapsed = !collapsed)}>
				{collapsed ? '▸' : '▾'}
			</button>
			<button type="button" class="hide" onclick={() => setDevMode(false)} title="Disable dev mode">
				✕
			</button>
		</div>
		{#if !collapsed}
			<div class="body">
				<div class="row">
					<span class="label">Brand</span>
					<span class="value">{brand.id}</span>
				</div>

				<button
					type="button"
					class="fresh-toggle"
					class:on={fresh}
					onclick={() => {
						toggleFreshMode();
						// Force a navigation so SSR loads see the new cookie state.
						window.location.reload();
					}}
				>
					<span class="fresh-track"><span class="fresh-thumb"></span></span>
					<span class="fresh-label">
						<span class="fresh-title">Fresh mode</span>
						<span class="fresh-sub">{fresh ? 'caches bypassed (cold-start)' : 'caches active (warm)'}</span>
					</span>
				</button>

				<div class="row">
					<span class="label">Generations</span>
					<span class="value">{traces.length}</span>
				</div>
				{#if recentLatency != null}
					<div class="row">
						<span class="label">Avg latency</span>
						<span class="value">{recentLatency}ms</span>
					</div>
					<div class="row">
						<span class="label">Cache hits</span>
						<span class="value">{cacheHits}/{traces.length}</span>
					</div>
				{/if}
				<div class="legend">
					<div class="legend-row"><span class="swatch swatch-engine"></span> AI · /api/layout</div>
					<div class="legend-row"><span class="swatch swatch-admin"></span> Authored · admin</div>
					<div class="legend-row"><span class="swatch swatch-fallback"></span> Fallback · static</div>
					<div class="legend-row"><span class="swatch swatch-foundation"></span> Foundation · primitive</div>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.aisles-dev-toolbar {
		position: fixed;
		bottom: 16px;
		right: 16px;
		z-index: 9999;
		min-width: 220px;
		max-width: 280px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 11px;
		color: #f4f4f5;
		background: #18181b;
		border: 1px solid #27272a;
		border-radius: 4px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
	}

	.header {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		border-bottom: 1px solid #27272a;
	}

	.collapsed .header {
		border-bottom: none;
	}

	.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #dc2626;
		box-shadow: 0 0 6px rgba(220, 38, 38, 0.6);
	}

	.title {
		flex: 1;
		font-weight: 600;
		letter-spacing: 0.04em;
	}

	.collapse,
	.hide {
		padding: 0 4px;
		font-size: 11px;
		line-height: 14px;
		color: #a1a1aa;
		background: transparent;
		border: none;
		cursor: pointer;
	}

	.collapse:hover,
	.hide:hover {
		color: #f4f4f5;
	}

	.body {
		padding: 6px 8px;
	}

	.row {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		padding: 2px 0;
	}

	.label {
		color: #a1a1aa;
	}

	.value {
		color: #f4f4f5;
		font-weight: 500;
	}

	.legend {
		margin-top: 6px;
		padding-top: 6px;
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

	.fresh-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		margin-top: 4px;
		padding: 6px 4px;
		background: transparent;
		border: 1px solid #27272a;
		border-radius: 4px;
		color: inherit;
		font-family: inherit;
		font-size: 11px;
		cursor: pointer;
		text-align: left;
	}

	.fresh-toggle:hover {
		border-color: #3f3f46;
	}

	.fresh-toggle.on {
		border-color: #dc2626;
		background: rgba(220, 38, 38, 0.08);
	}

	.fresh-track {
		position: relative;
		width: 22px;
		height: 12px;
		border-radius: 999px;
		background: #3f3f46;
		flex-shrink: 0;
		transition: background-color 0.15s ease;
	}

	.fresh-toggle.on .fresh-track {
		background: #dc2626;
	}

	.fresh-thumb {
		position: absolute;
		top: 1px;
		left: 1px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #f4f4f5;
		transition: transform 0.15s ease;
	}

	.fresh-toggle.on .fresh-thumb {
		transform: translateX(10px);
	}

	.fresh-label {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
		gap: 1px;
	}

	.fresh-title {
		font-weight: 600;
		color: #f4f4f5;
	}

	.fresh-sub {
		font-size: 10px;
		color: #a1a1aa;
	}
</style>

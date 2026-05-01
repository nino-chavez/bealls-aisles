<script lang="ts">
	/**
	 * Dev-mode wrapper that decorates AI-composed zones with a corner badge.
	 *
	 * Renders children inside a `position: relative` wrapper. When body has
	 * `aisles-dev-mode` class:
	 *   - dashed outline appears around the zone
	 *   - corner badge shows: source · zoneId · optional context
	 *
	 * No effect when dev mode is off — children render unchanged. Wrapper
	 * does NOT alter layout flow (display: contents not used because we
	 * need positioning context for the badge).
	 */

	import type { Snippet } from 'svelte';

	let {
		zoneId,
		source = 'engine',
		persona,
		reasoning,
		latencyMs,
		layer = 'engine',
		children,
	}: {
		/** Zone instance ID (e.g., "home.featured-row.1") or block component name */
		zoneId: string;
		/** Where the content came from in the resolver cascade */
		source?: 'engine' | 'admin' | 'fallback' | 'foundation';
		/** Detected persona at composition time */
		persona?: string;
		/** Optional one-line reasoning from the AI */
		reasoning?: string;
		/** Optional latency for the composition that produced this zone */
		latencyMs?: number;
		/** Architectural layer this zone belongs to */
		layer?: 'engine' | 'foundation' | 'admin';
		children: Snippet;
	} = $props();

	const sourceLabel = $derived(
		source === 'engine'
			? 'AI'
			: source === 'admin'
				? 'Authored'
				: source === 'foundation'
					? 'Foundation'
					: 'Fallback',
	);
</script>

<div
	class="aisles-dev-zone"
	data-aisles-zone={zoneId}
	data-aisles-source={source}
	data-aisles-layer={layer}
>
	<div class="aisles-dev-badge">
		<span class="badge-source badge-source-{source}">{sourceLabel}</span>
		<span class="badge-zone">{zoneId}</span>
		{#if persona}
			<span class="badge-meta">· {persona}</span>
		{/if}
		{#if latencyMs != null}
			<span class="badge-meta">· {latencyMs}ms</span>
		{/if}
	</div>
	{#if reasoning}
		<div class="aisles-dev-reasoning" title={reasoning}>
			{reasoning}
		</div>
	{/if}
	{@render children()}
</div>

<style>
	.aisles-dev-zone {
		position: relative;
	}

	/* Badges only render under the global body class so non-dev users see nothing. */
	:global(body:not(.aisles-dev-mode)) .aisles-dev-badge,
	:global(body:not(.aisles-dev-mode)) .aisles-dev-reasoning {
		display: none;
	}

	:global(body.aisles-dev-mode) .aisles-dev-zone {
		outline: 1px dashed rgba(220, 38, 38, 0.6);
		outline-offset: 2px;
		border-radius: 2px;
	}

	.aisles-dev-badge {
		position: absolute;
		top: -10px;
		left: 8px;
		z-index: 30;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		font-size: 10px;
		font-weight: 600;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		line-height: 14px;
		letter-spacing: 0.04em;
		color: white;
		background: #111;
		border-radius: 2px;
		pointer-events: none;
		white-space: nowrap;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
	}

	.badge-source {
		padding: 0 4px;
		border-radius: 2px;
	}

	.badge-source-engine { background: #dc2626; }
	.badge-source-admin { background: #2563eb; }
	.badge-source-fallback { background: #6b7280; }
	.badge-source-foundation { background: #047857; }

	.badge-zone {
		opacity: 0.95;
	}

	.badge-meta {
		opacity: 0.7;
		font-weight: 400;
	}

	.aisles-dev-reasoning {
		position: absolute;
		top: 8px;
		right: 8px;
		max-width: 280px;
		z-index: 30;
		padding: 4px 8px;
		font-size: 10px;
		line-height: 14px;
		color: #444;
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 2px;
		pointer-events: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>

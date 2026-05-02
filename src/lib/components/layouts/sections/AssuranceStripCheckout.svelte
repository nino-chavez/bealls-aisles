<script lang="ts">
	/**
	 * AssuranceStripCheckout — trust strip rendered before BC handoff.
	 *
	 * Layer: engine (AI selects the variant by inferred shopper signal).
	 * The variant biases item copy: first-time → safety/return language,
	 * returning → speed/welcome-back, loyalty-known → tier benefits.
	 *
	 * The AI emits an items array; this component just renders.
	 */
	export interface AssuranceItem {
		icon: string;
		label: string;
		body?: string;
	}

	// Variant is currently a typed marker the AI emits per ADR-007 §3.5; the
	// renderer doesn't branch on it visually yet (Phase 4 Decisions Inspector
	// will surface it). Accept the prop so the schema round-trips.
	let {
		items,
	}: {
		items: AssuranceItem[];
		variant?: 'first-time' | 'returning' | 'loyalty-known';
	} = $props();

	function key(name: string): string {
		return name.trim().toLowerCase().replace(/[^a-z]/g, '');
	}
</script>

<div class="grid gap-4 rounded-sm border border-surface-border bg-surface-card p-5 sm:grid-cols-3">
	{#each items as item (item.label)}
		{@const k = key(item.icon)}
		<div class="flex items-start gap-3">
			<span aria-hidden="true" class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
				{#if k === 'secure' || k === 'lock' || k === 'safe' || k === 'shield'}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
					</svg>
				{:else if k === 'returns' || k === 'return' || k === 'refund'}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 7v6h6" />
						<path d="M3 13a9 9 0 1 0 3-7" />
					</svg>
				{:else if k === 'shipping' || k === 'truck' || k === 'delivery' || k === 'freeshipping'}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 7h11v9H3z" />
						<path d="M14 10h4l3 3v3h-7" />
						<circle cx="7.5" cy="17.5" r="1.5" />
						<circle cx="17.5" cy="17.5" r="1.5" />
					</svg>
				{:else if k === 'rewards' || k === 'loyalty' || k === 'star' || k === 'points'}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 3l2.6 5.5 5.9.6-4.4 4.2 1.2 5.9L12 16.8l-5.3 2.4 1.2-5.9L3.5 9.1l5.9-.6z" />
					</svg>
				{:else if k === 'quality' || k === 'check' || k === 'sparkle' || k === 'value'}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<path d="M5 12l4 4 10-10" />
					</svg>
				{:else}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
						<circle cx="12" cy="12" r="9" />
					</svg>
				{/if}
			</span>
			<div>
				<p class="text-sm font-medium">{item.label}</p>
				{#if item.body}
					<p class="mt-0.5 text-xs text-surface-muted-fg">{item.body}</p>
				{/if}
			</div>
		</div>
	{/each}
</div>

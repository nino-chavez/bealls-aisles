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
</script>

<div class="grid gap-4 rounded-sm border border-surface-border bg-surface-card p-5 sm:grid-cols-3">
	{#each items as item (item.label)}
		<div class="flex items-start gap-3">
			<span aria-hidden="true" class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-base">
				{item.icon}
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

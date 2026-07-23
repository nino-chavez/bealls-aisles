<script lang="ts">
	/**
	 * FreeShippingMeter — progress bar to brand free-shipping threshold.
	 *
	 * Layer: foundation. Threshold comes from brand.config.ts incentives;
	 * the parent passes current subtotal + threshold (already in dollars,
	 * not minor units — caller converts).
	 */
	let {
		current,
		threshold,
	}: {
		current: number;
		threshold: number;
	} = $props();

	const fmt = (n: number) =>
		`$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

	let remaining = $derived(Math.max(0, threshold - current));
	let pct = $derived(Math.min(100, Math.round((current / threshold) * 100)));
	let unlocked = $derived(remaining === 0);
</script>

<div class="rounded-sm bg-surface-muted px-4 py-3">
	<div class="flex items-center justify-between text-xs">
		{#if unlocked}
			<span class="font-medium text-success">You unlocked free shipping</span>
		{:else}
			<span class="font-medium">Add {fmt(remaining)} for free shipping</span>
			<span class="text-surface-muted-fg">{fmt(current)} / {fmt(threshold)}</span>
		{/if}
	</div>
	<div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-border">
		<div
			class="h-full rounded-full transition-all duration-300"
			class:bg-success={unlocked}
			class:bg-primary={!unlocked}
			style="width: {pct}%"
		></div>
	</div>
</div>

<script lang="ts">
	/**
	 * CartSummary — order totals (subtotal, shipping, tax, total).
	 *
	 * Layer: foundation. Values come from cart state — the parent computes
	 * subtotal from line items; shipping/tax are estimates until BC's
	 * Optimized Checkout finalizes them.
	 */
	let {
		subtotal,
		shipping,
		tax,
		total,
		showEstimateNote = true,
	}: {
		subtotal: number;
		shipping?: number | null;
		tax?: number | null;
		total: number;
		showEstimateNote?: boolean;
	} = $props();

	const fmt = (n: number) =>
		`$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
</script>

<div class="space-y-2 text-sm">
	<div class="flex items-center justify-between">
		<span class="text-surface-muted-fg">Subtotal</span>
		<span class="font-medium">{fmt(subtotal)}</span>
	</div>
	<div class="flex items-center justify-between">
		<span class="text-surface-muted-fg">Shipping</span>
		<span class="font-medium">
			{#if shipping == null}
				<span class="text-surface-muted-fg">Calculated at checkout</span>
			{:else if shipping === 0}
				Free
			{:else}
				{fmt(shipping)}
			{/if}
		</span>
	</div>
	<div class="flex items-center justify-between">
		<span class="text-surface-muted-fg">Tax</span>
		<span class="font-medium">
			{#if tax == null}
				<span class="text-surface-muted-fg">Calculated at checkout</span>
			{:else}
				{fmt(tax)}
			{/if}
		</span>
	</div>
	<div class="mt-3 flex items-center justify-between border-t border-surface-border pt-3">
		<span class="font-medium">Total</span>
		<span class="text-lg font-semibold">{fmt(total)}</span>
	</div>
	{#if showEstimateNote && (shipping == null || tax == null)}
		<p class="pt-1 text-xs text-surface-muted-fg">
			Final shipping and tax are calculated at checkout based on delivery address.
		</p>
	{/if}
</div>

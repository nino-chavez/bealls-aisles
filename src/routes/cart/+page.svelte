<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import CartLineItems from '$lib/components/layouts/sections/CartLineItems.svelte';
	import CartSummary from '$lib/components/layouts/sections/CartSummary.svelte';
	import FreeShippingMeter from '$lib/components/layouts/sections/FreeShippingMeter.svelte';
	import PromoCodeEntry from '$lib/components/layouts/sections/PromoCodeEntry.svelte';
	import EmptyRescue from '$lib/components/EmptyRescue.svelte';
	import type { CartLineItem } from '$lib/components/layouts/sections/CartLineItems.svelte';
	import { getBrand } from '$lib/brand/config';
	import ZoneExecutionEvidence from '$lib/foundation/ZoneExecutionEvidence.svelte';
	import RuntimeZone from '$lib/foundation/RuntimeZone.svelte';

	let { data }: { data: PageData } = $props();

	// Local mirror so qty mutations re-render without a full server round-trip.
	let items = $state<CartLineItem[]>(data.cart?.lineItems.physicalItems ?? []);

	let subtotal = $derived(items.reduce((sum, i) => sum + i.salePrice.value * i.quantity, 0));
	let itemCount = $derived(items.reduce((sum, i) => sum + i.quantity, 0));

	const persona = data.personaHint ?? 'gatherer';
	const brandCfg = getBrand();
	const categories = Object.entries(brandCfg.categories).map(([slug, cfg]) => ({
		slug,
		name: cfg.displayName,
	}));

	onMount(() => {
		const onUpdate = () => refreshCart();
		window.addEventListener('cart-updated', onUpdate);
		return () => window.removeEventListener('cart-updated', onUpdate);
	});

	async function refreshCart() {
		try {
			const res = await fetch('/api/cart');
			const d = await res.json();
			items = d.cart?.lineItems?.physicalItems || [];
		} catch {
			// keep current items on transient failure
		}
	}

</script>

<svelte:head>
	<title>Cart ({itemCount})</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-6 py-8">
	<h1 class="font-display text-3xl tracking-tight">Cart</h1>

	{#if items.length === 0}
		<div class="mt-8 rounded-sm border border-surface-border bg-surface-card p-8 text-center" data-empty-state="empty-cart">
			<p class="text-surface-muted-fg">Your cart is empty</p>
			<a href="/" class="mt-4 inline-block text-sm font-medium text-primary hover:text-secondary">
				Continue shopping
			</a>
		</div>
		<div class="mt-12 border-t border-surface-border pt-8">
			<EmptyRescue reason="empty-cart" {persona} {categories} />
		</div>
	{:else}
		<div class="mt-8 grid gap-10 lg:grid-cols-[2fr_1fr]">
			<!-- Left column: items + promo. Shopper-paid model upsells are retired. -->
			<div>
				<!-- Foundation: cart-line-items -->
				<CartLineItems {items} />

				{#if data.freeShippingThreshold !== null}
					<div class="mt-6">
						<!-- Foundation: free-shipping-meter -->
						<FreeShippingMeter current={subtotal} threshold={data.freeShippingThreshold} />
					</div>
				{/if}

			</div>

			<!-- Right column: summary + promo + checkout -->
			<aside class="space-y-6">
				<div class="rounded-sm border border-surface-border bg-surface-card p-6">
					<h2 class="mb-4 font-display text-lg">Order summary</h2>
					<!-- Foundation: cart-summary -->
					<CartSummary {subtotal} total={subtotal} />
					<div class="mt-6">
						<RuntimeZone execution={data.zoneExecution} zoneId="cart.above-checkout-cta" products={data.upsellProducts ?? []} />
					</div>
					<a
						href="/checkout"
						class="mt-6 block w-full rounded-sm bg-primary py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
					>
						Checkout — {itemCount} item{itemCount === 1 ? '' : 's'}
					</a>
				</div>
				<div class="rounded-sm border border-surface-border bg-surface-card p-6">
					<!-- Foundation: promo-code-entry -->
					<PromoCodeEntry />
				</div>
			</aside>
		</div>
	{/if}
</div>

<ZoneExecutionEvidence executions={data.emptyZoneExecution ? [data.zoneExecution, data.emptyZoneExecution] : [data.zoneExecution]} />

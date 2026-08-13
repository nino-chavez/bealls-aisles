<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import CartLineItems from '$lib/components/layouts/sections/CartLineItems.svelte';
	import CartSummary from '$lib/components/layouts/sections/CartSummary.svelte';
	import FreeShippingMeter from '$lib/components/layouts/sections/FreeShippingMeter.svelte';
	import PromoCodeEntry from '$lib/components/layouts/sections/PromoCodeEntry.svelte';
	import LastChanceUpsellRow from '$lib/components/layouts/sections/LastChanceUpsellRow.svelte';
	import AILoadingInline from '$lib/components/AILoadingInline.svelte';
	import EmptyRescue from '$lib/components/EmptyRescue.svelte';
	import type { CartLineItem } from '$lib/components/layouts/sections/CartLineItems.svelte';
	import type { ShopperProduct } from '$lib/foundation/shopper-product';
	import { getBrand } from '$lib/brand/config';
	import ZoneExecutionEvidence from '$lib/foundation/ZoneExecutionEvidence.svelte';
	import RuntimeEnvelopeZone from '$lib/foundation/RuntimeEnvelopeZone.svelte';
	import {
		runtimeZoneViewFromEnvelope,
		type RuntimeZoneEnvelopeView,
	} from '$lib/foundation/runtime-zone-envelope';

	let { data }: { data: PageData } = $props();

	// Local mirror so qty mutations re-render without a full server round-trip.
	let items = $state<CartLineItem[]>(data.cart?.lineItems.physicalItems ?? []);
	let upsellProducts = $state<ShopperProduct[]>([]);
	let upsellTitle = $state('Last chance — pair these with your order');
	let upsellLoading = $state(false);
	let upsellZone = $state<RuntimeZoneEnvelopeView | null>(null);

	let subtotal = $derived(items.reduce((sum, i) => sum + i.salePrice.value * i.quantity, 0));
	let itemCount = $derived(items.reduce((sum, i) => sum + i.quantity, 0));

	const persona = data.personaHint ?? 'gatherer';
	const brandCfg = getBrand();
	const categories = Object.entries(brandCfg.categories).map(([slug, cfg]) => ({
		slug,
		name: cfg.displayName,
	}));

	onMount(() => {
		if (items.length > 0) loadUpsells();
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

	async function loadUpsells() {
		upsellLoading = true;
		upsellZone = null;
		try {
			// PRD-ENG-019: cart line-item entityIds drive the tag-overlap
			// neighborhood that becomes the upsell candidate pool.
			const cartItemEntityIds = items.map((i) => i.productEntityId).filter((n): n is number => Number.isFinite(n));
			const res = await fetch('/api/layout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ categorySlug: 'cart', persona, cartItemEntityIds }),
			});
			if (!res.ok) return;
			const d = await res.json();
			const zone = (Array.isArray(d?.envelopes) ? d.envelopes : [])
				.map((raw: unknown) => runtimeZoneViewFromEnvelope(raw, {
					organizationId: data.zoneExecution.organizationId,
					brandId: data.zoneExecution.brandId,
					routeId: '/cart',
					routePath: data.zoneExecution.routePath,
					surface: 'cart',
					zoneId: 'cart.above-checkout-cta',
					component: 'last-chance-upsell-row',
				}))
				.find((candidate: RuntimeZoneEnvelopeView | null): candidate is RuntimeZoneEnvelopeView => candidate !== null);
			if (!zone) return;
			const upsell = zone.content;
			upsellTitle = (upsell.props?.title as string) ?? upsellTitle;
			const refs: Array<{ productId: string }> = upsell.props?.products ?? [];
			const candidates: ShopperProduct[] = d?.products ?? [];
			const inCart = new Set(items.map((i) => i.productEntityId));
			upsellProducts = refs
				.map((ref) => candidates.find((c) => c.id === ref.productId || String(c.entityId) === ref.productId))
				.filter((p): p is ShopperProduct => !!p && !inCart.has(p.entityId))
				.slice(0, 4);
			if (upsellProducts.length > 0) upsellZone = zone;
		} catch {
			// upsells are optional; continue without them
			upsellZone = null;
		} finally {
			upsellLoading = false;
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
			<!-- Left column: items + policy-authorized upsell + promo -->
			<div>
				<!-- Foundation: cart-line-items -->
				<CartLineItems {items} />

				{#if data.freeShippingThreshold !== null}
					<div class="mt-6">
						<!-- Foundation: free-shipping-meter -->
						<FreeShippingMeter current={subtotal} threshold={data.freeShippingThreshold} />
					</div>
				{/if}

				{#if upsellLoading}
					<div class="mt-10 border-t border-surface-border pt-8">
						<AILoadingInline label="Selecting pieces that pair with your cart" />
					</div>
				{:else if upsellZone && upsellProducts.length > 0}
					<RuntimeEnvelopeZone view={upsellZone} className="mt-10 border-t border-surface-border pt-8">
						<LastChanceUpsellRow title={upsellTitle} products={upsellProducts} />
					</RuntimeEnvelopeZone>
				{/if}
			</div>

			<!-- Right column: summary + promo + checkout -->
			<aside class="space-y-6">
				<div class="rounded-sm border border-surface-border bg-surface-card p-6">
					<h2 class="mb-4 font-display text-lg">Order summary</h2>
					<!-- Foundation: cart-summary -->
					<CartSummary {subtotal} total={subtotal} />
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

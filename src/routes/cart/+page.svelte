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
	import type { Product } from '$lib/types';
	import { getBrand } from '$lib/brand/config';

	let { data }: { data: PageData } = $props();

	// Local mirror so qty mutations re-render without a full server round-trip.
	let items = $state<CartLineItem[]>(data.cart?.lineItems.physicalItems ?? []);
	let upsellProducts = $state<Product[]>([]);
	let upsellTitle = $state('Last chance — pair these with your order');
	let upsellLoading = $state(false);

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
		try {
			// PRD-ENG-019: cart line-item entityIds drive the tag-overlap
			// neighborhood that becomes the upsell candidate pool.
			const cartItemEntityIds = items.map((i) => i.productEntityId).filter((n): n is number => Number.isFinite(n));
			const res = await fetch('/api/layout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ surface: 'cart', categorySlug: 'cart', persona, cartItemEntityIds }),
			});
			if (!res.ok) return;
			const d = await res.json();
			const sections = d?.layout?.sections ?? [];
			const upsell = sections.find((s: { component: string }) => s.component === 'last-chance-upsell-row');
			if (!upsell) return;
			upsellTitle = (upsell.props?.title as string) ?? upsellTitle;
			const refs: Array<{ productId: string }> = upsell.props?.products ?? [];
			const candidates: Product[] = d?.products ?? [];
			const inCart = new Set(items.map((i) => i.productEntityId));
			upsellProducts = refs
				.map((ref) => candidates.find((c) => c.id === ref.productId || String(c.entityId) === ref.productId))
				.filter((p): p is Product => !!p && !inCart.has(p.entityId))
				.slice(0, 4);
		} catch {
			// upsells are optional; continue without them
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
		<div class="mt-8 rounded-sm border border-surface-border bg-surface-card p-8 text-center">
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
			<!-- Left column: items + upsell + promo -->
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
				{:else if upsellProducts.length > 0}
					<div class="mt-10 border-t border-surface-border pt-8">
						<!-- Engine: last-chance-upsell-row -->
						<LastChanceUpsellRow title={upsellTitle} products={upsellProducts} />
					</div>
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

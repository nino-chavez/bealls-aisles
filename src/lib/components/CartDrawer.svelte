<script lang="ts">
	import EmptyRescue from '$lib/components/EmptyRescue.svelte';
	import CartLineItems from '$lib/components/layouts/sections/CartLineItems.svelte';
	import CartSummary from '$lib/components/layouts/sections/CartSummary.svelte';
	import FreeShippingMeter from '$lib/components/layouts/sections/FreeShippingMeter.svelte';
	import PromoCodeEntry from '$lib/components/layouts/sections/PromoCodeEntry.svelte';
	import LastChanceUpsellRow from '$lib/components/layouts/sections/LastChanceUpsellRow.svelte';
	import AILoadingInline from '$lib/components/AILoadingInline.svelte';
	import DevZoneBadge from '$lib/components/dev/DevZoneBadge.svelte';
	import type { CartLineItem } from '$lib/components/layouts/sections/CartLineItems.svelte';
	import type { Product } from '$lib/types';
	import { getBrand } from '$lib/brand/config';

	let {
		open = false,
		onclose,
		persona = 'gatherer',
		categories = [],
	}: {
		open: boolean;
		onclose: () => void;
		persona?: string;
		categories?: Array<{ slug: string; name: string }>;
	} = $props();

	let items = $state<CartLineItem[]>([]);
	let upsellProducts = $state<Product[]>([]);
	let upsellTitle = $state('You might also like');
	let isLoading = $state(false);
	let upsellLoading = $state(false);
	let subtotal = $derived(items.reduce((sum, item) => sum + item.salePrice.value * item.quantity, 0));
	let itemCount = $derived(items.reduce((sum, item) => sum + item.quantity, 0));

	const brand = getBrand();
	const freeShippingThreshold = brand.incentives?.freeShippingThresholdMinor != null
		? brand.incentives.freeShippingThresholdMinor / 100
		: null;

	$effect(() => {
		if (open) {
			loadCart();
		}
	});

	async function loadCart() {
		isLoading = true;
		try {
			const res = await fetch('/api/cart');
			const data = await res.json();
			items = data.cart?.lineItems?.physicalItems || [];
		} catch {
			items = [];
		} finally {
			isLoading = false;
		}
		// Foundation/engine separation: line items + summary + meter come from
		// cart state. Upsell row comes from /api/layout?surface=cart through
		// the engine. The schema today emits `last-chance-upsell-row` as the
		// only AI-composable cart block (per CartLayoutSchema specialization).
		if (items.length > 0) {
			loadUpsells();
		} else {
			upsellProducts = [];
		}
	}

	async function loadUpsells() {
		upsellLoading = true;
		try {
			// PRD-ENG-019: pass the cart's line-item entityIds so the layout
			// API can source upsell candidates from their tag-overlap
			// neighborhood (rather than brand-wide popular products).
			const cartItemEntityIds = items.map((i) => i.productEntityId).filter((n): n is number => Number.isFinite(n));
			const res = await fetch('/api/layout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					surface: 'cart',
					categorySlug: 'cart',
					persona,
					cartItemEntityIds,
				}),
			});
			if (!res.ok) {
				upsellProducts = [];
				return;
			}
			const data = await res.json();
			const sections = data?.layout?.sections ?? [];
			const upsellSection = sections.find((s: { component: string }) => s.component === 'last-chance-upsell-row');
			if (!upsellSection) {
				upsellProducts = [];
				return;
			}
			upsellTitle = (upsellSection.props?.title as string) ?? upsellTitle;
			const productRefs: Array<{ productId: string }> = upsellSection.props?.products ?? [];
			const candidates: Product[] = data?.products ?? [];
			// Dedupe against in-cart entityIds — don't pitch what's already there.
			const inCart = new Set(items.map((i) => i.productEntityId));
			upsellProducts = productRefs
				.map((ref) => candidates.find((c) => c.id === ref.productId || String(c.entityId) === ref.productId))
				.filter((p): p is Product => !!p && !inCart.has(p.entityId))
				.slice(0, 3);
		} catch {
			upsellProducts = [];
		} finally {
			upsellLoading = false;
		}
	}
</script>

<!-- Backdrop -->
{#if open}
	<div class="fixed inset-0 z-50 flex justify-end">
		<!-- Overlay -->
		<button
			class="absolute inset-0 bg-neutral-950/30 backdrop-blur-[2px]"
			onclick={onclose}
			aria-label="Close cart"
		></button>

		<!-- Drawer -->
		<div class="relative z-10 flex h-full w-full max-w-md flex-col bg-surface-bg shadow-xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-surface-border px-6 py-4">
				<h2 class="font-display text-lg">Cart ({itemCount})</h2>
				<button onclick={onclose} class="text-surface-muted-fg hover:text-surface-fg" aria-label="Close">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
				</button>
			</div>

			<!-- Body -->
			<div class="flex-1 overflow-y-auto px-6 py-4">
				{#if isLoading}
					<div class="animate-pulse space-y-4">
						{#each Array(2) as _}
							<div class="flex gap-4">
								<div class="h-20 w-20 rounded-sm bg-surface-muted"></div>
								<div class="flex-1 space-y-2">
									<div class="h-4 w-32 rounded bg-surface-muted"></div>
									<div class="h-3 w-16 rounded bg-surface-muted"></div>
								</div>
							</div>
						{/each}
					</div>
				{:else if items.length === 0}
					<div class="flex flex-col items-center text-center pt-6">
						<p class="text-surface-muted-fg">Your cart is empty</p>
						<button onclick={onclose} class="mt-3 text-sm font-medium text-primary hover:text-secondary">
							Continue shopping
						</button>
					</div>
					<!-- PRD-FND-012: AI rescue band beneath the standard empty copy. -->
					<div class="mt-8 border-t border-surface-border pt-6">
						<EmptyRescue
							reason="empty-cart"
							{persona}
							{categories}
						/>
					</div>
				{:else}
					<!-- Foundation: cart-line-items block (cart state). -->
					<CartLineItems {items} />

					<!-- Foundation: free-shipping-meter (cart state + brand threshold). -->
					{#if freeShippingThreshold !== null}
						<div class="mt-6">
							<FreeShippingMeter current={subtotal} threshold={freeShippingThreshold} />
						</div>
					{/if}

					<!-- Engine: AI-composed upsell row above checkout CTA. -->
					{#if upsellLoading}
						<div class="mt-6 border-t border-surface-border pt-6">
							<AILoadingInline label="Selecting pieces that pair with your cart" size="small" />
						</div>
					{:else if upsellProducts.length > 0}
						<DevZoneBadge zoneId="cart.above-checkout-cta" source="engine" layer="engine" {persona}>
							<div class="mt-6 border-t border-surface-border pt-6">
								<LastChanceUpsellRow title={upsellTitle} products={upsellProducts} />
							</div>
						</DevZoneBadge>
					{/if}

					<!-- Foundation: promo-code-entry (cart state). -->
					<div class="mt-6 border-t border-surface-border pt-6">
						<PromoCodeEntry />
					</div>
				{/if}
			</div>

			<!-- Footer -->
			{#if items.length > 0}
				<div class="border-t border-surface-border px-6 py-4">
					<!-- Foundation: cart-summary (cart state). -->
					<CartSummary
						{subtotal}
						total={subtotal}
						showEstimateNote={false}
					/>
					<a
						href="/checkout"
						class="mt-4 block w-full rounded-sm bg-primary py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
					>
						Checkout
					</a>
					<a
						href="/cart"
						onclick={onclose}
						class="mt-2 block w-full py-2 text-center text-sm text-surface-muted-fg hover:text-surface-fg"
					>
						View full cart
					</a>
				</div>
			{/if}
		</div>
	</div>
{/if}

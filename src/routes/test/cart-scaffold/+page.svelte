<script lang="ts">
	/**
	 * /test/cart-scaffold — visual fixture rendering all 5 cart blocks
	 * + the checkout assurance strip against synthetic state. Used for
	 * visual regression and quick sanity-check during Phase 3 wiring.
	 *
	 * No real cart state, no API calls — synthetic only. Drop in /test/
	 * (not the production route tree). Brand styling still applies.
	 */
	import CartLineItems from '$lib/components/layouts/sections/CartLineItems.svelte';
	import CartSummary from '$lib/components/layouts/sections/CartSummary.svelte';
	import FreeShippingMeter from '$lib/components/layouts/sections/FreeShippingMeter.svelte';
	import PromoCodeEntry from '$lib/components/layouts/sections/PromoCodeEntry.svelte';
	import LastChanceUpsellRow from '$lib/components/layouts/sections/LastChanceUpsellRow.svelte';
	import AssuranceStripCheckout from '$lib/components/layouts/sections/AssuranceStripCheckout.svelte';
	import type { CartLineItem } from '$lib/components/layouts/sections/CartLineItems.svelte';
	import type { Product } from '$lib/types';

	const items: CartLineItem[] = [
		{
			lineId: 'li1',
			productEntityId: 1001,
			variantEntityId: null,
			productPath: '/product/walnut-coffee-table',
			name: 'Walnut coffee table',
			quantity: 1,
			unitPrice: { value: 249.0, currencyCode: 'USD' },
			extendedPrice: { value: 249.0, currencyCode: 'USD' },
			imageUrl: 'https://picsum.photos/seed/walnut/200/200',
			isMutable: true,
		},
		{
			lineId: 'li2',
			productEntityId: 1002,
			variantEntityId: null,
			productPath: '/product/linen-throw-blanket',
			name: 'Linen throw blanket',
			quantity: 2,
			unitPrice: { value: 39.0, currencyCode: 'USD' },
			extendedPrice: { value: 78.0, currencyCode: 'USD' },
			imageUrl: 'https://picsum.photos/seed/linen/200/200',
			isMutable: true,
		},
	];

	const subtotal = items.reduce((sum, i) => sum + i.extendedPrice.value, 0);

	const upsellProducts: Product[] = [
		{
			id: 'ceramic-vase',
			entityId: 1101,
			name: 'Ceramic vase',
			price: 24.0,
			image: 'https://picsum.photos/seed/vase/200/200',
		} as Product,
		{
			id: 'wool-runner',
			entityId: 1102,
			name: 'Wool runner',
			price: 89.0,
			image: 'https://picsum.photos/seed/runner/200/200',
		} as Product,
		{
			id: 'glass-pendant-lamp',
			entityId: 1103,
			name: 'Glass pendant lamp',
			price: 119.0,
			image: 'https://picsum.photos/seed/lamp/200/200',
		} as Product,
	];

	const assuranceItems = [
		{ icon: '🔒', label: 'Secure checkout', body: 'PCI-compliant payment, encrypted in transit.' },
		{ icon: '↩︎', label: 'Easy returns', body: 'Return online orders for free within 60 days.' },
		{ icon: '🚚', label: 'Free shipping', body: 'On orders over $99 — automatically applied.' },
	];
</script>

<svelte:head>
	<title>Cart scaffold fixture</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-12 px-6 py-12">
	<header>
		<h1 class="font-display text-3xl">Cart scaffold fixture</h1>
		<p class="mt-2 text-sm text-surface-muted-fg">
			Visual reference for the 5 cart blocks + checkout assurance strip. Synthetic state, no API calls.
		</p>
	</header>

	<section data-block="cart-line-items">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">
			cart-line-items
		</h2>
		<CartLineItems {items} />
	</section>

	<section data-block="free-shipping-meter">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">
			free-shipping-meter
		</h2>
		<FreeShippingMeter current={subtotal} threshold={99} />
	</section>

	<section data-block="promo-code-entry">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">
			promo-code-entry
		</h2>
		<PromoCodeEntry />
	</section>

	<section data-block="last-chance-upsell-row">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">
			last-chance-upsell-row (engine-composed)
		</h2>
		<LastChanceUpsellRow title="Pair these with your order" products={upsellProducts} />
	</section>

	<section data-block="cart-summary">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">
			cart-summary
		</h2>
		<div class="rounded-sm border border-surface-border bg-surface-card p-6">
			<CartSummary {subtotal} total={subtotal} />
		</div>
	</section>

	<section data-block="assurance-strip-checkout">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">
			assurance-strip-checkout (engine-composed; first-time variant)
		</h2>
		<AssuranceStripCheckout items={assuranceItems} variant="first-time" />
	</section>
</div>

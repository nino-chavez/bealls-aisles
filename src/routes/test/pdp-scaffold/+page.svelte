<script lang="ts">
	import ImageGallery from '$lib/components/layouts/sections/ImageGallery.svelte';
	import ProductTitleBlock from '$lib/components/layouts/sections/ProductTitleBlock.svelte';
	import VariantSelector from '$lib/components/layouts/sections/VariantSelector.svelte';
	import StockSignal from '$lib/components/layouts/sections/StockSignal.svelte';
	import AddToCartBar from '$lib/components/layouts/sections/AddToCartBar.svelte';
	import DescriptionTabs from '$lib/components/layouts/sections/DescriptionTabs.svelte';
	import ReviewsSummary from '$lib/components/layouts/sections/ReviewsSummary.svelte';
	import ReviewsList from '$lib/components/layouts/sections/ReviewsList.svelte';
	import BOPISPicker from '$lib/components/layouts/sections/BOPISPicker.svelte';

	const galleryImages = [
		{ url: 'https://picsum.photos/seed/p1/800/600', alt: 'Walnut coffee table — front view' },
		{ url: 'https://picsum.photos/seed/p2/800/600', alt: 'Walnut coffee table — angle' },
		{ url: 'https://picsum.photos/seed/p3/800/600', alt: 'Walnut coffee table — top down' },
		{ url: 'https://picsum.photos/seed/p4/800/600', alt: 'Walnut coffee table — detail' },
	];

	const variantGroups: Array<{
		name: string;
		style: 'chip' | 'swatch' | 'dropdown';
		options: Array<{ id: string; label: string; available: boolean; swatch?: string }>;
	}> = [
		{
			name: 'Size',
			style: 'chip',
			options: [
				{ id: 's', label: 'Small', available: true },
				{ id: 'm', label: 'Medium', available: true },
				{ id: 'l', label: 'Large', available: false },
			],
		},
		{
			name: 'Color',
			style: 'swatch',
			options: [
				{ id: 'walnut', label: 'Walnut', available: true, swatch: '#5d3a1a' },
				{ id: 'oak', label: 'Oak', available: true, swatch: '#c8a062' },
				{ id: 'black', label: 'Charcoal', available: true, swatch: '#2a2a2a' },
			],
		},
	];

	const descriptionTabs = [
		{
			label: 'Description',
			content:
				'<p>Solid kiln-dried walnut with a waterfall edge. Hand-finished with a matte oil that highlights the grain without sealing the surface plastic.</p>',
		},
		{
			label: 'Specs',
			content:
				'<table class="w-full border-collapse text-sm">' +
				'<tr><th class="py-2 pr-6 text-left text-surface-muted-fg font-normal">Material</th><td class="py-2 font-medium">Solid walnut</td></tr>' +
				'<tr><th class="py-2 pr-6 text-left text-surface-muted-fg font-normal">Finish</th><td class="py-2 font-medium">Matte oil</td></tr>' +
				'<tr><th class="py-2 pr-6 text-left text-surface-muted-fg font-normal">Dimensions</th><td class="py-2 font-medium">48&quot;W × 24&quot;D × 16&quot;H</td></tr>' +
				'</table>',
		},
		{
			label: 'Shipping & returns',
			content:
				'<p>Free shipping on orders $99+. Standard delivery 3–5 business days.</p>' +
				'<p>Free returns within 60 days, in store or by mail.</p>',
		},
	];

	const reviews = [
		{ id: 'r1', author: 'Margaret W.', date: '2026-04-22T00:00:00Z', rating: 5, title: 'Beautiful piece', body: 'Even better in person. The grain is gorgeous and it feels solid.', helpful: 8, verifiedPurchase: true },
		{ id: 'r2', author: 'Jordan T.', date: '2026-04-15T00:00:00Z', rating: 4, title: 'Good for the price', body: 'Slight scratch on arrival but customer service replaced it quickly.', helpful: 3, verifiedPurchase: true },
		{ id: 'r3', author: 'Anna L.', date: '2026-04-08T00:00:00Z', rating: 5, body: 'Exactly as pictured. Easy assembly.', helpful: 5, verifiedPurchase: true },
	];

	const stores = [
		{ id: 's1', name: 'Bealls Sarasota', address: '123 Tamiami Trail, Sarasota FL', distanceMi: 1.4, hours: 'Open 10am–9pm', pickupReady: true, readyByLabel: 'Ready by 4pm today' },
		{ id: 's2', name: 'Bealls Bradenton', address: '900 Cortez Rd W, Bradenton FL', distanceMi: 6.8, hours: 'Open 10am–9pm', pickupReady: true, readyByLabel: 'Ready by 6pm today' },
		{ id: 's3', name: 'Bealls Venice', address: '500 US-41 Bypass S, Venice FL', distanceMi: 11.2, hours: 'Open 10am–8pm', pickupReady: false },
	];
</script>

<div class="mx-auto max-w-7xl px-6 py-8">
	<h1 class="font-display text-3xl">PDP scaffold — visual fixture</h1>
	<p class="mt-2 text-surface-muted-fg">Phase 3 Slice 1 + 2 blocks rendered with stub data. Not for production.</p>

	<div class="mt-12 grid gap-12 lg:grid-cols-2">
		<ImageGallery images={galleryImages} productName="Walnut coffee table" />

		<div class="flex flex-col gap-6">
			<ProductTitleBlock
				productName="Walnut coffee table"
				brandLabel="Bealls"
				price={649}
				salePrice={499}
				rating={4.6}
				reviewCount={128}
			/>

			<StockSignal level="last-few" message="Only 3 left at this price" urgency="hard" />

			<VariantSelector groups={variantGroups} />

			<AddToCartBar
				productEntityId={9999}
				ctaLabel="Add to Cart"
				price={499}
				showQuantity={true}
				secondaryAction="find-in-store"
				productId="walnut-coffee-table"
				productName="Walnut coffee table"
				productCategory="living-room"
			/>
		</div>
	</div>

	<div class="mt-16">
		<DescriptionTabs tabs={descriptionTabs} />
	</div>

	<div class="mt-12">
		<ReviewsSummary
			avgRating={4.6}
			reviewCount={128}
			histogram={[2, 4, 12, 38, 72]}
			writeReviewHref="#write-review"
		/>
		<ReviewsList {reviews} />
	</div>

	<div class="mt-12">
		<BOPISPicker zip="34229" {stores} productName="Walnut coffee table" />
	</div>

	<div class="mt-16 border-t border-surface-border pt-8">
		<h2 class="font-display text-2xl">Stock signal variants</h2>
		<div class="mt-4 flex flex-wrap gap-3">
			<StockSignal level="plentiful" message="In stock — ships within 2 days" urgency="none" />
			<StockSignal level="low" message="Selling fast" urgency="soft" />
			<StockSignal level="last-few" message="Only 3 left at this price" urgency="hard" />
			<StockSignal level="out" message="Out of stock" urgency="soft" />
		</div>
	</div>
</div>

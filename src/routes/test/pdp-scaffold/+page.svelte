<script lang="ts">
	import ImageGallery from '$lib/components/layouts/sections/ImageGallery.svelte';
	import ProductTitleBlock from '$lib/components/layouts/sections/ProductTitleBlock.svelte';
	import VariantSelector from '$lib/components/layouts/sections/VariantSelector.svelte';
	import StockSignal from '$lib/components/layouts/sections/StockSignal.svelte';
	import AddToCartBar from '$lib/components/layouts/sections/AddToCartBar.svelte';

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
</script>

<div class="mx-auto max-w-7xl px-6 py-8">
	<h1 class="font-display text-3xl">PDP scaffold — visual fixture</h1>
	<p class="mt-2 text-surface-muted-fg">Phase 3 Slice 1 blocks rendered with stub data. Not for production.</p>

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

			<p class="text-sm leading-relaxed text-surface-muted-fg">
				Solid kiln-dried walnut with a waterfall edge. Hand-finished with a matte oil that highlights the grain without sealing the surface plastic.
			</p>

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

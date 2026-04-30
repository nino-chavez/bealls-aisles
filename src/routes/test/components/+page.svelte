<script lang="ts">
	import LayoutRenderer from '$lib/components/layouts/LayoutRenderer.svelte';
	import type { Layout } from '$lib/schema/layout';
	import type { Product } from '$lib/types';

	const products: Product[] = [
		{
			id: 'p1',
			entityId: 1001,
			name: "Women's Solid V-Neck Top",
			brand: 'Joie De Vivre',
			price: 20,
			salePrice: 9.99,
			image: 'https://picsum.photos/seed/p1/600/600',
			imageAlt: 'Red V-neck top',
			description: 'Soft modal blend, easy drape, perfect for layering.',
			specs: { material: 'Modal blend', sleeve: 'Short' },
			tags: ['top'],
			category: 'tops',
			rating: 4.5,
			reviewCount: 128,
			badges: ['New', 'Deal'],
		},
		{
			id: 'p2',
			entityId: 1002,
			name: "Women's Bermuda Shorts",
			brand: 'Dash',
			price: 28,
			salePrice: 14.99,
			image: 'https://picsum.photos/seed/p2/600/600',
			imageAlt: 'Tan bermuda shorts',
			description: 'Stretch poplin with elastic waistband.',
			specs: { material: '98% cotton', inseam: '11"' },
			tags: ['bottom'],
			category: 'bottoms',
			rating: 4.8,
			reviewCount: 412,
			badges: ['Deal'],
		},
		{
			id: 'p3',
			entityId: 1003,
			name: "Women's Sleeveless Wrap Dress",
			brand: 'Love Scarlett',
			price: 22,
			salePrice: 10.99,
			image: 'https://picsum.photos/seed/p3/600/600',
			imageAlt: 'Floral wrap dress',
			description: 'Wrap silhouette in a vibrant floral print.',
			specs: { material: 'Rayon blend', length: 'Midi' },
			tags: ['dress'],
			category: 'dresses',
			rating: 4.2,
			reviewCount: 67,
			badges: ['New'],
		},
		{
			id: 'p4',
			entityId: 1004,
			name: 'Embellished Crochet Bag',
			brand: 'Coastal Hand',
			price: 39,
			salePrice: 19.99,
			image: 'https://picsum.photos/seed/p4/600/600',
			imageAlt: 'Crochet bag',
			description: 'Hand-finished crochet with embellished trim.',
			specs: { material: 'Cotton', strap: 'Adjustable' },
			tags: ['accessory'],
			category: 'accessories',
			rating: 4.6,
			reviewCount: 203,
			badges: ['Clearance'],
		},
		{
			id: 'p5',
			entityId: 1005,
			name: 'Pull-On Cat Eye Pocket Shorts',
			brand: 'Dash',
			price: 26,
			salePrice: 12.99,
			image: 'https://picsum.photos/seed/p5/600/600',
			imageAlt: 'Cat eye shorts',
			description: 'Soft elastic waist, deep pockets, all-day comfort.',
			specs: { material: 'Stretch twill', inseam: '7"' },
			tags: ['bottom'],
			category: 'bottoms',
			rating: 4.4,
			reviewCount: 156,
		},
	];

	const storefrontLayout: Layout = {
		persona: 'hunter',
		reasoning: 'Test fixture — exercises every storefront-mode component once.',
		productOrder: ['p1', 'p2', 'p3', 'p4', 'p5'],
		sections: [
			{
				component: 'promo-strip',
				props: {
					eyebrow: 'TODAY ONLY',
					headline: 'Free shipping on orders $99+',
					ctaLabel: 'Shop Now',
					ctaHref: '/c/women',
					urgency: 'hard',
				},
			},
			{
				component: 'editorial-hero',
				props: {
					image: 'https://picsum.photos/seed/hero/1600/700',
					eyebrow: 'NEW SEASON',
					headline: 'Florida is a feeling',
					body: 'Sunshine state living never looked so good. Browse the warm-weather edit.',
					ctaLabel: 'Shop the Edit',
					ctaHref: '/c/women/vacation',
					textPosition: 'left',
				},
			},
			{
				component: 'editorial-header',
				props: {
					eyebrow: 'THE TREND SHOP',
					headline: 'Pieces worth packing',
					body: 'Lightweight layers and easy dresses for the next trip.',
				},
			},
			{
				component: 'price-rail',
				props: {
					columns: 2,
					tiers: [
						{
							label: 'Under $25',
							image: 'https://picsum.photos/seed/tier1/800/500',
							href: '/c/under-25',
							savingsBadge: 'Up to 60% off',
						},
						{
							label: 'Under $50',
							image: 'https://picsum.photos/seed/tier2/800/500',
							href: '/c/under-50',
							savingsBadge: 'Up to 70% off',
						},
					],
				},
			},
			{
				component: 'category-tile-grid',
				props: {
					sectionLabel: 'Vacation Mode',
					columns: 4,
					tiles: [
						{
							label: "Women's Vacation",
							image: 'https://picsum.photos/seed/cat1/600/450',
							href: '/c/women/vacation',
						},
						{
							label: "Kids' Vacation",
							image: 'https://picsum.photos/seed/cat2/600/450',
							href: '/c/kids/vacation',
						},
						{
							label: "Men's Vacation",
							image: 'https://picsum.photos/seed/cat3/600/450',
							href: '/c/men/vacation',
						},
						{
							label: 'SPF & Sun Essentials',
							image: 'https://picsum.photos/seed/cat4/600/450',
							href: '/c/spf-sun',
						},
					],
				},
			},
			{
				component: 'coupon-strip',
				props: {
					eyebrow: 'OFFER FOR YOU',
					headline: 'Get $10 off when you spend $80+',
					body: 'Code applies in cart once threshold is met. One per customer.',
					code: 'SAVE10',
					ctaLabel: 'Get Code',
				},
			},
			{
				component: 'product-carousel',
				props: {
					title: 'Best Sellers',
					products: [
						{ productId: 'p1', role: 'standard' },
						{ productId: 'p2', role: 'standard' },
						{ productId: 'p3', role: 'standard' },
						{ productId: 'p4', role: 'standard' },
						{ productId: 'p5', role: 'standard' },
					],
					showRating: true,
					showBadges: true,
					showQuickAdd: true,
				},
			},
			{
				component: 'category-header',
				props: {
					title: 'Women / Tops',
					subtitle: '124 results',
					showSort: true,
					showFilter: true,
					subcategories: [
						{ label: 'New Arrivals', href: '/c/women/tops/new' },
						{ label: 'Tops', href: '/c/women/tops' },
						{ label: 'Bottoms', href: '/c/women/bottoms' },
						{ label: 'Dresses', href: '/c/women/dresses' },
					],
				},
			},
			{
				component: 'product-grid',
				props: {
					columns: 4,
					imageRatio: 'square',
					showDescription: false,
					showSpecs: false,
					showQuickAdd: true,
					showRating: true,
					showBadges: true,
					products: [
						{ productId: 'p1', role: 'standard' },
						{ productId: 'p2', role: 'standard' },
						{ productId: 'p3', role: 'standard' },
						{ productId: 'p4', role: 'standard' },
					],
				},
			},
			{
				component: 'lifestyle-price-hero',
				props: {
					image: 'https://picsum.photos/seed/lifestyle/1600/700',
					category: 'Handbags',
					priceLabel: 'starting at $19.99',
					ctaLabel: 'Shop Bags',
					ctaHref: '/c/handbags',
				},
			},
			{
				component: 'bealls-bucks-callout',
				props: {
					mode: 'earn',
					amount: 5,
					unit: 'Bealls Bucks',
					threshold: 100,
				},
			},
			{
				component: 'hero-product',
				props: {
					product: { productId: 'p4', role: 'hero' },
					showSpecs: true,
				},
			},
		],
	};
</script>

<svelte:head>
	<title>Component test bed</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-6 py-10">
	<header class="mb-12 border-b border-surface-border pb-6">
		<p class="text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">Test bed</p>
		<h1 class="mt-2 text-3xl font-display tracking-tight">Storefront-mode components</h1>
		<p class="mt-3 max-w-2xl text-sm leading-relaxed text-surface-muted-fg">
			Renders every storefront-mode component once with fixture data. No AI, no BC, no Redis — purely a visual sanity check for the Phase 2 component vocabulary expansion.
		</p>
	</header>

	<LayoutRenderer layout={storefrontLayout} {products} />
</div>

<script lang="ts">
	import type { Layout } from '$lib/schema/layout';
	import type { Product } from '$lib/types';
	import EditorialHeader from './sections/EditorialHeader.svelte';
	import HeroProduct from './sections/HeroProduct.svelte';
	import ProductGrid from './sections/ProductGrid.svelte';
	import CategoryHeader from './sections/CategoryHeader.svelte';
	import PromoStrip from './sections/PromoStrip.svelte';
	import CategoryTileGrid from './sections/CategoryTileGrid.svelte';
	import PriceRail from './sections/PriceRail.svelte';
	import ProductCarousel from './sections/ProductCarousel.svelte';
	import CouponStrip from './sections/CouponStrip.svelte';
	import EditorialHero from './sections/EditorialHero.svelte';
	import BeallsBucksCallout from './sections/BeallsBucksCallout.svelte';
	import LifestylePriceHero from './sections/LifestylePriceHero.svelte';

	let { layout, products }: { layout: Layout; products: Product[] } = $props();

	/** Resolve a product ID to the full product object */
	function resolveProduct(productId: string): Product | undefined {
		return products.find((p) => p.id === productId || String(p.entityId) === productId);
	}

	/** Resolve an array of product refs to full product objects */
	function resolveProducts(refs: Array<{ productId: string }>): Product[] {
		return refs
			.map((ref) => resolveProduct(ref.productId))
			.filter((p): p is Product => p !== undefined);
	}
</script>

{#each layout.sections as section}
	{#if section.component === 'editorial-header' && section.props?.eyebrow}
		<EditorialHeader
			eyebrow={section.props.eyebrow}
			headline={section.props.headline}
			body={section.props.body}
		/>
	{:else if section.component === 'hero-product' && section.props?.product?.productId}
		{@const product = resolveProduct(section.props.product.productId)}
		{#if product}
			<HeroProduct {product} showSpecs={section.props.showSpecs} />
		{/if}
	{:else if section.component === 'product-grid' && section.props?.products?.length}
		{@const gridProducts = resolveProducts(section.props.products)}
		<ProductGrid
			columns={section.props.columns}
			products={gridProducts}
			imageRatio={section.props.imageRatio}
			showDescription={section.props.showDescription}
			showSpecs={section.props.showSpecs}
			showQuickAdd={section.props.showQuickAdd}
			showRating={section.props.showRating}
			showBadges={section.props.showBadges}
		/>
	{:else if section.component === 'category-header' && section.props?.title}
		<CategoryHeader
			title={section.props.title}
			subtitle={section.props.subtitle}
			showSort={section.props.showSort}
			showFilter={section.props.showFilter}
			heroImage={section.props.heroImage}
			subcategories={section.props.subcategories}
		/>
	{:else if section.component === 'promo-strip' && section.props?.headline}
		<PromoStrip
			eyebrow={section.props.eyebrow}
			headline={section.props.headline}
			ctaLabel={section.props.ctaLabel}
			ctaHref={section.props.ctaHref}
			urgency={section.props.urgency}
		/>
	{:else if section.component === 'category-tile-grid' && section.props?.tiles?.length}
		<CategoryTileGrid
			sectionLabel={section.props.sectionLabel}
			columns={section.props.columns}
			tiles={section.props.tiles}
		/>
	{:else if section.component === 'price-rail' && section.props?.tiers?.length}
		<PriceRail
			columns={section.props.columns}
			tiers={section.props.tiers}
		/>
	{:else if section.component === 'product-carousel' && section.props?.products?.length}
		{@const carouselProducts = resolveProducts(section.props.products)}
		<ProductCarousel
			title={section.props.title}
			products={carouselProducts}
			showRating={section.props.showRating}
			showBadges={section.props.showBadges}
			showQuickAdd={section.props.showQuickAdd}
		/>
	{:else if section.component === 'coupon-strip' && section.props?.headline}
		<CouponStrip
			eyebrow={section.props.eyebrow}
			headline={section.props.headline}
			body={section.props.body}
			code={section.props.code}
			ctaLabel={section.props.ctaLabel}
		/>
	{:else if section.component === 'editorial-hero' && section.props?.headline}
		<EditorialHero
			image={section.props.image}
			eyebrow={section.props.eyebrow}
			headline={section.props.headline}
			body={section.props.body}
			ctaLabel={section.props.ctaLabel}
			ctaHref={section.props.ctaHref}
			textPosition={section.props.textPosition}
		/>
	{:else if section.component === 'bealls-bucks-callout' && section.props?.unit}
		<BeallsBucksCallout
			mode={section.props.mode}
			amount={section.props.amount}
			unit={section.props.unit}
			threshold={section.props.threshold}
			tierLabel={section.props.tierLabel}
		/>
	{:else if section.component === 'lifestyle-price-hero' && section.props?.priceLabel}
		<LifestylePriceHero
			image={section.props.image}
			category={section.props.category}
			priceLabel={section.props.priceLabel}
			ctaLabel={section.props.ctaLabel}
			ctaHref={section.props.ctaHref}
		/>
	{/if}
{/each}

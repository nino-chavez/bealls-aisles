<script lang="ts">
	/**
	 * ZoneRenderer — dispatches a resolved zone to the matching block component.
	 *
	 * The page's load function calls `resolveZone()` and passes the resolution
	 * to this component. The page never branches on source — that's the
	 * resolver's job. ZoneRenderer only dispatches on `content.component`.
	 *
	 * Hidden semantic: when `resolution.content === null`, render no DOM at all.
	 *
	 * Block dispatch is currently scoped to components needed by zones wired
	 * in this phase. Phase 3+ extends the dispatch table as PDP/cart/checkout
	 * specialization adds more zones.
	 */

	import type { ZoneResolution } from './resolve-zone';
	import type { Product } from '$lib/types';
	import EditorialHeader from '$lib/components/layouts/sections/EditorialHeader.svelte';
	import EditorialHero from '$lib/components/layouts/sections/EditorialHero.svelte';
	import LifestylePriceHero from '$lib/components/layouts/sections/LifestylePriceHero.svelte';
	import CategoryTileGrid from '$lib/components/layouts/sections/CategoryTileGrid.svelte';
	import PromoStrip from '$lib/components/layouts/sections/PromoStrip.svelte';
	import CouponStrip from '$lib/components/layouts/sections/CouponStrip.svelte';
	import ProductGrid from '$lib/components/layouts/sections/ProductGrid.svelte';
	import ProductCarousel from '$lib/components/layouts/sections/ProductCarousel.svelte';
	import ForYouRow from '$lib/components/layouts/sections/ForYouRow.svelte';
	import BeallsBucksCallout from '$lib/components/layouts/sections/BeallsBucksCallout.svelte';
	import BOPISPicker from '$lib/components/layouts/sections/BOPISPicker.svelte';
	import LastChanceUpsellRow from '$lib/components/layouts/sections/LastChanceUpsellRow.svelte';
	import AssuranceStripCheckout from '$lib/components/layouts/sections/AssuranceStripCheckout.svelte';
	import EventCountdown from '$lib/components/layouts/sections/EventCountdown.svelte';
	import BrandSpotlight from '$lib/components/layouts/sections/BrandSpotlight.svelte';
	import TrendShop from '$lib/components/layouts/sections/TrendShop.svelte';
	import EmailCaptureInline from '$lib/components/layouts/sections/EmailCaptureInline.svelte';
	import ServiceCalloutsGrid from '$lib/components/layouts/sections/ServiceCalloutsGrid.svelte';
	import LocatorStrip from '$lib/components/layouts/sections/LocatorStrip.svelte';
	import BOPISStrip from '$lib/components/layouts/sections/BOPISStrip.svelte';
	import ClusterChipRow from '$lib/components/layouts/sections/ClusterChipRow.svelte';
	import DevZoneBadge from '$lib/components/dev/DevZoneBadge.svelte';

	let {
		resolution,
		products = [],
	}: {
		resolution: ZoneResolution;
		/** Catalog for resolving ProductRef[] in carousel/grid blocks. */
		products?: Product[];
	} = $props();

	function resolveProducts(refs: Array<{ productId: string }> = []): Product[] {
		return refs
			.map((ref) => products.find((p) => p.id === ref.productId || String(p.entityId) === ref.productId))
			.filter((p): p is Product => p !== undefined);
	}

	type BlockContent = { component: string; props: Record<string, unknown> };

	function isBlockContent(c: unknown): c is BlockContent {
		return typeof c === 'object' && c !== null && 'component' in c && 'props' in c;
	}

	let items = $derived.by((): BlockContent[] => {
		if (resolution.content === null || resolution.content === undefined) return [];
		if (Array.isArray(resolution.content)) {
			return resolution.content.filter(isBlockContent);
		}
		return isBlockContent(resolution.content) ? [resolution.content] : [];
	});
</script>

{#each items as item (item.component + JSON.stringify(item.props).slice(0, 32))}
<DevZoneBadge
	zoneId={resolution.zoneId ?? item.component}
	source={resolution.source}
	layer={resolution.source === 'engine' ? 'engine' : resolution.source === 'admin' ? 'admin' : 'foundation'}
>
	{#if item.component === 'editorial-header'}
		<EditorialHeader
			eyebrow={item.props.eyebrow as string}
			headline={item.props.headline as string}
			body={item.props.body as string}
		/>
	{:else if item.component === 'editorial-hero'}
		<EditorialHero
			image={item.props.image as string}
			eyebrow={item.props.eyebrow as string | undefined}
			headline={item.props.headline as string}
			body={item.props.body as string | undefined}
			ctaLabel={item.props.ctaLabel as string | undefined}
			ctaHref={item.props.ctaHref as string | undefined}
			textPosition={item.props.textPosition as 'left' | 'center' | 'right'}
		/>
	{:else if item.component === 'lifestyle-price-hero'}
		<LifestylePriceHero
			image={item.props.image as string}
			category={item.props.category as string}
			priceLabel={item.props.priceLabel as string}
			ctaLabel={item.props.ctaLabel as string}
			ctaHref={item.props.ctaHref as string}
		/>
	{:else if item.component === 'category-tile-grid'}
		<CategoryTileGrid
			sectionLabel={item.props.sectionLabel as string | undefined}
			columns={item.props.columns as 2 | 3 | 4 | 5}
			tiles={item.props.tiles as Array<{ label: string; image: string; href: string; description?: string }>}
		/>
	{:else if item.component === 'promo-strip'}
		<PromoStrip
			eyebrow={item.props.eyebrow as string | undefined}
			headline={item.props.headline as string}
			ctaLabel={item.props.ctaLabel as string | undefined}
			ctaHref={item.props.ctaHref as string | undefined}
			urgency={item.props.urgency as 'none' | 'soft' | 'hard'}
		/>
	{:else if item.component === 'coupon-strip'}
		<CouponStrip
			eyebrow={item.props.eyebrow as string}
			headline={item.props.headline as string}
			body={item.props.body as string | undefined}
			code={item.props.code as string | undefined}
			ctaLabel={item.props.ctaLabel as string}
		/>
	{:else if item.component === 'product-grid'}
		{@const gridProducts = resolveProducts((item.props.products as Array<{ productId: string }>) ?? [])}
		{#if gridProducts.length > 0}
			<ProductGrid
				columns={item.props.columns as 2 | 3 | 4}
				products={gridProducts}
				imageRatio={item.props.imageRatio as 'landscape' | 'square'}
				showDescription={item.props.showDescription as boolean}
				showSpecs={item.props.showSpecs as boolean}
				showQuickAdd={item.props.showQuickAdd as boolean}
				showRating={item.props.showRating as boolean | undefined}
				showBadges={item.props.showBadges as boolean | undefined}
			/>
		{/if}
	{:else if item.component === 'product-carousel'}
		{@const carouselProducts = resolveProducts((item.props.products as Array<{ productId: string }>) ?? [])}
		{#if carouselProducts.length > 0}
			<ProductCarousel
				title={item.props.title as string}
				products={carouselProducts}
				showRating={item.props.showRating as boolean | undefined}
				showBadges={item.props.showBadges as boolean | undefined}
				showQuickAdd={item.props.showQuickAdd as boolean | undefined}
			/>
		{/if}
	{:else if item.component === 'for-you-row'}
		{@const forYouProducts = resolveProducts((item.props.products as Array<{ productId: string }>) ?? [])}
		{#if forYouProducts.length > 0}
			<ForYouRow
				title={item.props.title as string}
				reasoning={item.props.reasoning as string | undefined}
				products={forYouProducts}
			/>
		{/if}
	{:else if item.component === 'bealls-bucks-callout'}
		<BeallsBucksCallout
			mode={item.props.mode as 'earn' | 'redeem' | 'tier-progress'}
			amount={item.props.amount as number}
			unit={item.props.unit as string}
			threshold={item.props.threshold as number | undefined}
			tierLabel={item.props.tierLabel as string | undefined}
		/>
	{:else if item.component === 'bopis-picker'}
		<BOPISPicker
			zip={item.props.zip as string | undefined}
			stores={item.props.stores as Array<{
				id: string;
				name: string;
				address: string;
				distanceMi?: number;
				hours: string;
				pickupReady: boolean;
				readyByLabel?: string;
			}>}
			productName={item.props.productName as string | undefined}
		/>
	{:else if item.component === 'last-chance-upsell-row'}
		{@const upsellProducts = resolveProducts((item.props.products as Array<{ productId: string }>) ?? [])}
		{#if upsellProducts.length > 0}
			<LastChanceUpsellRow
				title={item.props.title as string}
				products={upsellProducts}
			/>
		{/if}
	{:else if item.component === 'assurance-strip-checkout'}
		<AssuranceStripCheckout
			items={item.props.items as Array<{ icon: string; label: string; body?: string }>}
			variant={item.props.variant as 'first-time' | 'returning' | 'loyalty-known'}
		/>
	{:else if item.component === 'event-countdown'}
		<EventCountdown
			eyebrow={item.props.eyebrow as string | undefined}
			headline={item.props.headline as string}
			body={item.props.body as string | undefined}
			endsAt={item.props.endsAt as string}
			ctaLabel={item.props.ctaLabel as string | undefined}
			ctaHref={item.props.ctaHref as string | undefined}
		/>
	{:else if item.component === 'brand-spotlight'}
		<BrandSpotlight
			brandName={item.props.brandName as string}
			eyebrow={item.props.eyebrow as string | undefined}
			headline={item.props.headline as string}
			body={item.props.body as string}
			image={item.props.image as string}
			ctaLabel={item.props.ctaLabel as string | undefined}
			ctaHref={item.props.ctaHref as string | undefined}
		/>
	{:else if item.component === 'trend-shop'}
		<TrendShop
			sectionLabel={item.props.sectionLabel as string | undefined}
			headline={item.props.headline as string}
			image={item.props.image as string}
			ctaLabel={item.props.ctaLabel as string}
			ctaHref={item.props.ctaHref as string}
		/>
	{:else if item.component === 'email-capture-inline'}
		<EmailCaptureInline
			eyebrow={item.props.eyebrow as string | undefined}
			headline={item.props.headline as string}
			body={item.props.body as string | undefined}
			offerCopy={item.props.offerCopy as string | undefined}
			ctaLabel={item.props.ctaLabel as string}
			privacyNote={item.props.privacyNote as string | undefined}
		/>
	{:else if item.component === 'service-callouts-grid'}
		<ServiceCalloutsGrid
			columns={item.props.columns as 3 | 4}
			callouts={item.props.callouts as Array<{ icon: string; label: string; body?: string }>}
		/>
	{:else if item.component === 'locator-strip'}
		<LocatorStrip
			eyebrow={item.props.eyebrow as string | undefined}
			headline={item.props.headline as string}
			body={item.props.body as string | undefined}
			ctaLabel={item.props.ctaLabel as string}
			ctaHref={item.props.ctaHref as string}
		/>
	{:else if item.component === 'bopis-strip'}
		<BOPISStrip
			storeName={item.props.storeName as string}
			distanceMi={item.props.distanceMi as number}
			readyByLabel={item.props.readyByLabel as string}
			productName={item.props.productName as string | undefined}
			ctaLabel={item.props.ctaLabel as string | undefined}
			ctaHref={item.props.ctaHref as string | undefined}
		/>
	{:else if item.component === 'cluster-chip-row'}
		<ClusterChipRow
			sectionLabel={item.props.sectionLabel as string | undefined}
			chips={item.props.chips as Array<{ label: string; href: string }>}
		/>
	{/if}
</DevZoneBadge>
{/each}

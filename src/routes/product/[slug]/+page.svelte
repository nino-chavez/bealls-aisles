<script lang="ts">
	import type { PageData } from './$types';
	import { getEmitter } from '$lib/signals/emitter';
	import { addPick, isPicked, removePick } from '$lib/stores/picks.svelte';
	import ImageGallery from '$lib/components/layouts/sections/ImageGallery.svelte';
	import ProductTitleBlock from '$lib/components/layouts/sections/ProductTitleBlock.svelte';
	import VariantSelector from '$lib/components/layouts/sections/VariantSelector.svelte';
	import StockSignal from '$lib/components/layouts/sections/StockSignal.svelte';
	import AddToCartBar from '$lib/components/layouts/sections/AddToCartBar.svelte';
	import DescriptionTabs from '$lib/components/layouts/sections/DescriptionTabs.svelte';
	import ReviewsSummary from '$lib/components/layouts/sections/ReviewsSummary.svelte';
	import ReviewsList from '$lib/components/layouts/sections/ReviewsList.svelte';
	import BOPISStrip from '$lib/components/layouts/sections/BOPISStrip.svelte';
	import RuntimeZone from '$lib/foundation/RuntimeZone.svelte';
	import ZoneExecutionEvidence from '$lib/foundation/ZoneExecutionEvidence.svelte';
	import DevZoneBadge from '$lib/components/dev/DevZoneBadge.svelte';
	import StructuredData from '$lib/components/primitives/StructuredData.svelte';
	import { productLd, breadcrumbLd } from '$lib/seo/jsonld';
	import { getBrand } from '$lib/brand/config';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();
	let product = $derived(data.product);
	let relatedProducts = $derived(data.relatedProducts);

	const _brand = getBrand();
	const productJsonLd = $derived(
		productLd({
			id: product.id,
			name: product.name,
			description: product.description.replace(/<[^>]*>/g, '').slice(0, 5000),
			image: product.image,
			brand: _brand.name,
			sku: product.id,
			price: product.salePrice ?? product.price,
			url: `${$page.url.origin}/product/${product.id}`,
			rating:
				data.reviewsSummary.reviewCount > 0
					? { value: data.reviewsSummary.avgRating, count: data.reviewsSummary.reviewCount }
					: null,
		})
	);
	const breadcrumbJsonLd = $derived(
		breadcrumbLd([
			{ name: 'Home', url: $page.url.origin },
			{ name: product.category, url: `${$page.url.origin}/category/${product.category.toLowerCase().replace(/\s+/g, '-')}` },
			{ name: product.name, url: `${$page.url.origin}/product/${product.id}` },
		])
	);

	// Track dwell time on product pages
	$effect(() => {
		const startTime = Date.now();
		const productId = product.id;

		return () => {
			const dwellMs = Date.now() - startTime;
			const emitter = getEmitter();
			if (emitter && dwellMs > 3000) {
				emitter.emit('interact.dwell_time', {
					productId,
					dwellMs,
					category: product.category,
				});
			}
		};
	});

</script>

<svelte:head>
	<title>{product.name}</title>
	<meta name="description" content={product.descriptionPlain.slice(0, 160)} />
</svelte:head>

<StructuredData data={productJsonLd} />
<StructuredData data={breadcrumbJsonLd} />

<div class="mx-auto max-w-7xl px-6 py-8">
	<!-- Breadcrumb (PDP scaffold; future P0 block) -->
	<nav class="mb-8 text-sm text-surface-muted-fg">
		<a href="/" class="hover:text-surface-fg">Home</a>
		<span class="mx-2">/</span>
		{#if product.categoryPath}
			<a href="/category/{product.categoryPath.replace(/^\/|\/$/g, '').replace(/^(bealls|beallsflorida|homecentric)-/i, '')}" class="hover:text-surface-fg">{product.category.replace(/^(Bealls|BeallsFlorida|HomeCentric)\s+/i, '')}</a>
			<span class="mx-2">/</span>
		{/if}
		<span class="text-surface-fg">{product.name}</span>
	</nav>

	<!-- PDP scaffold — fixed structure per ADR-007 / composition-taxonomy.md §5.3 -->
	<div class="grid gap-12 lg:grid-cols-2">
		<!-- Image gallery (scaffold) -->
		<ImageGallery images={data.galleryImages} productName={product.name} />

		<!-- Details column -->
		<div class="flex flex-col gap-6">
			<ProductTitleBlock
				productName={product.name}
				price={product.price}
				salePrice={product.salePrice}
				rating={data.reviewsSummary.avgRating || undefined}
				reviewCount={data.reviewsSummary.reviewCount || undefined}
			/>

			{#if data.stockSignal}
				<StockSignal
					level={data.stockSignal.level}
					message={data.stockSignal.message}
					urgency={data.stockSignal.urgency}
				/>
			{/if}

			<VariantSelector groups={data.variantGroups} />

			<AddToCartBar
				productEntityId={product.entityId}
				ctaLabel="Add to Cart"
				price={product.salePrice ?? product.price}
				showQuantity={true}
				secondaryAction="find-in-store"
				productId={product.id}
				productName={product.name}
				productCategory={product.category}
			/>

			<!-- PRD-ENG-017 — proximity-aware BOPIS strip. Renders only when shopper
			     ZIP geocodes to a pickup-ready store within 30 mi. -->
			{#if data.bopisStrip}
				<DevZoneBadge zoneId="pdp.bopis-strip" source="foundation" layer="foundation">
					<BOPISStrip
						storeName={data.bopisStrip.storeName}
						distanceMi={data.bopisStrip.distanceMi}
						readyByLabel={data.bopisStrip.readyByLabel}
						productName={data.bopisStrip.productName}
						ctaLabel={data.bopisStrip.ctaLabel}
						ctaHref={data.bopisStrip.ctaHref}
					/>
				</DevZoneBadge>
			{/if}

			<button
				onclick={() => isPicked(product.id) ? removePick(product.id) : addPick(product)}
				class="self-start rounded-sm border py-2.5 px-5 text-sm font-medium transition-colors
					{isPicked(product.id)
						? 'border-accent bg-accent/10 text-accent'
						: 'border-surface-border text-surface-muted-fg hover:border-accent hover:text-accent'}"
			>
				{isPicked(product.id) ? 'In Your Picks' : 'Add to Picks'}
			</button>

		</div>
	</div>

	<!-- Description tabs scaffold (Slice 2) -->
	<div class="mt-16">
		<DescriptionTabs tabs={data.descriptionTabs} />
	</div>

	<!-- pdp.below-description zone — engine/admin/static cascade -->
	<div class="mt-12">
		<RuntimeZone execution={data.zoneExecution} zoneId="pdp.below-description" products={relatedProducts} />
	</div>

	<!-- Reviews scaffold (Slice 2) — synthetic data until reviews integration ships -->
	<div class="mt-12">
		<ReviewsSummary
			avgRating={data.reviewsSummary.avgRating}
			reviewCount={data.reviewsSummary.reviewCount}
			histogram={data.reviewsSummary.histogram}
			writeReviewHref={data.reviewsSummary.writeReviewHref}
		/>
		<ReviewsList reviews={data.reviewsList} />
	</div>

	<!-- pdp.cross-sell zone — tag-overlap neighborhood (ADR-008 Phase B / PRD-ENG-019) -->
	<div class="mt-16">
		<RuntimeZone execution={data.zoneExecution} zoneId="pdp.cross-sell" products={relatedProducts} />
	</div>

	<!-- pdp.related zone — tag-overlap neighborhood, stricter (minOverlap=3) -->
	<div class="mt-12">
		<RuntimeZone execution={data.zoneExecution} zoneId="pdp.related" products={relatedProducts} />
	</div>

	<!-- pdp.recently-viewed zone — tag-overlap fallback substrate per ADR-008 §Cold-start safe;
	     real session-tracked viewed-products list lands with PRD-FND-018. -->
	<div class="mt-12">
		<RuntimeZone execution={data.zoneExecution} zoneId="pdp.recently-viewed" products={relatedProducts} />
	</div>

	<!-- pdp.below-recs zone — BOPIS picker scaffold (locator surface ships in Phase 6) -->
	<div class="mt-12">
		<RuntimeZone execution={data.zoneExecution} zoneId="pdp.below-recs" />
	</div>
</div>

<ZoneExecutionEvidence executions={[data.zoneExecution]} />

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
	import ZoneRenderer from '$lib/foundation/ZoneRenderer.svelte';

	let { data }: { data: PageData } = $props();
	let product = $derived(data.product);
	let relatedProducts = $derived(data.relatedProducts);

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

	let pairings = $state<Array<{ id: string; name: string; price: number; reason: string }>>([]);
	let pairingsLoading = $state(false);

	$effect(() => {
		const p = product;
		if (!p) return;
		pairingsLoading = true;
		fetch('/api/suggest', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				picks: [{ id: p.id, name: p.name, price: p.price, category: p.category, specs: p.specs }],
			}),
		})
			.then((r) => r.json())
			.then((data) => { pairings = data.suggestions || []; })
			.catch(() => {})
			.finally(() => { pairingsLoading = false; });
	});
</script>

<svelte:head>
	<title>{product.name}</title>
	<meta name="description" content={product.descriptionPlain.slice(0, 160)} />
</svelte:head>

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
				<BOPISStrip
					storeName={data.bopisStrip.storeName}
					distanceMi={data.bopisStrip.distanceMi}
					readyByLabel={data.bopisStrip.readyByLabel}
					productName={data.bopisStrip.productName}
					ctaLabel={data.bopisStrip.ctaLabel}
					ctaHref={data.bopisStrip.ctaHref}
				/>
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

			{#if pairingsLoading}
				<div class="border-t border-surface-border pt-6">
					<h3 class="font-display text-lg">Pairs well with</h3>
					<div class="mt-3 animate-pulse space-y-2">
						<div class="h-10 rounded bg-surface-muted"></div>
						<div class="h-10 rounded bg-surface-muted"></div>
					</div>
				</div>
			{:else if pairings.length > 0}
				<div class="border-t border-surface-border pt-6">
					<h3 class="font-display text-lg">Pairs well with</h3>
					<ul class="mt-3 space-y-2">
						{#each pairings as pairing}
							<li>
								<a
									href="/product/{pairing.id}"
									class="flex items-center justify-between rounded-sm border border-surface-border px-4 py-3 transition-colors hover:bg-surface-muted"
								>
									<div>
										<span class="text-sm font-medium">{pairing.name}</span>
										<span class="ml-2 text-xs text-surface-muted-fg">{pairing.reason}</span>
									</div>
									<span class="text-sm font-medium">${pairing.price.toLocaleString()}</span>
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	</div>

	<!-- Description tabs scaffold (Slice 2) -->
	<div class="mt-16">
		<DescriptionTabs tabs={data.descriptionTabs} />
	</div>

	<!-- pdp.below-description zone — engine/admin/static cascade -->
	<div class="mt-12">
		<ZoneRenderer resolution={data.belowDescriptionZone} products={relatedProducts} />
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
		<ZoneRenderer resolution={data.crossSellZone} products={relatedProducts} />
	</div>

	<!-- pdp.related zone — tag-overlap neighborhood, stricter (minOverlap=3) -->
	<div class="mt-12">
		<ZoneRenderer resolution={data.relatedZone} products={relatedProducts} />
	</div>

	<!-- pdp.recently-viewed zone — tag-overlap fallback substrate per ADR-008 §Cold-start safe;
	     real session-tracked viewed-products list lands with PRD-FND-018. -->
	<div class="mt-12">
		<ZoneRenderer resolution={data.recentlyViewedZone} products={relatedProducts} />
	</div>

	<!-- pdp.below-recs zone — BOPIS picker scaffold (locator surface ships in Phase 6) -->
	<div class="mt-12">
		<ZoneRenderer resolution={data.belowRecsZone} />
	</div>
</div>

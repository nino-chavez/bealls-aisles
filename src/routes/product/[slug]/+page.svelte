<script lang="ts">
	import type { PageData } from './$types';
	import { getEmitter } from '$lib/signals/emitter';
	import { addPick, isPicked, removePick } from '$lib/stores/picks.svelte';
	import ImageGallery from '$lib/components/layouts/sections/ImageGallery.svelte';
	import ProductTitleBlock from '$lib/components/layouts/sections/ProductTitleBlock.svelte';
	import VariantSelector from '$lib/components/layouts/sections/VariantSelector.svelte';
	import StockSignal from '$lib/components/layouts/sections/StockSignal.svelte';
	import AddToCartBar from '$lib/components/layouts/sections/AddToCartBar.svelte';
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
			<a href="/category/{product.categoryPath.replace(/^\/|\/$/g, '').replace(/^(haven|volt|ember)-/i, '')}" class="hover:text-surface-fg">{product.category.replace(/^(Haven|Volt|Ember)\s+/i, '')}</a>
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
			/>

			{#if data.stockSignal}
				<StockSignal
					level={data.stockSignal.level}
					message={data.stockSignal.message}
					urgency={data.stockSignal.urgency}
				/>
			{/if}

			<VariantSelector groups={data.variantGroups} />

			<!-- Description (Slice 2 will refactor to description-tabs scaffold block) -->
			<div class="leading-relaxed text-surface-muted-fg prose-sm">
				{@html product.description}
			</div>

			{#if Object.keys(product.specs).length > 0}
				<dl class="border-t border-surface-border pt-4">
					{#each Object.entries(product.specs) as [key, value]}
						<div class="flex justify-between border-b border-surface-border py-2.5">
							<dt class="text-sm text-surface-muted-fg">{key}</dt>
							<dd class="text-sm font-medium">{value}</dd>
						</div>
					{/each}
				</dl>
			{/if}

			<AddToCartBar
				productEntityId={product.entityId}
				ctaLabel="Add to Cart"
				price={product.salePrice ?? product.price}
				showQuantity={true}
				secondaryAction="none"
				productId={product.id}
				productName={product.name}
				productCategory={product.category}
			/>

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

	<!-- pdp.below-description zone — engine/admin/static cascade -->
	<div class="mt-16">
		<ZoneRenderer resolution={data.belowDescriptionZone} products={relatedProducts} />
	</div>

	<!-- Related products (Slice 2 migrates to pdp.related zone) -->
	{#if relatedProducts.length > 0}
		<section class="mt-16 border-t border-surface-border pt-12">
			<h2 class="text-2xl">You might also like</h2>
			<div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
				{#each relatedProducts as related}
					<a href="/product/{related.id}" class="group">
						<div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-muted">
							{#if related.image}
								<img
									src={related.image}
									alt={related.imageAlt}
									class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
									loading="lazy"
								/>
							{/if}
						</div>
						<div class="mt-3">
							<h3 class="text-sm font-medium group-hover:text-primary transition-colors">{related.name}</h3>
							<div class="mt-1">
								{#if related.salePrice}
									<span class="text-sm font-medium text-primary">${related.salePrice.toLocaleString()}</span>
									<span class="ml-1 text-xs text-surface-muted-fg line-through">${related.price.toLocaleString()}</span>
								{:else}
									<span class="text-sm font-medium">${related.price.toLocaleString()}</span>
								{/if}
							</div>
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}
</div>

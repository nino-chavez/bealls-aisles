<script lang="ts">
	import type { PageData } from './$types';
	import { getEmitter } from '$lib/signals/emitter';

	let { data }: { data: PageData } = $props();
	let product = $derived(data.product);
	let relatedProducts = $derived(data.relatedProducts);
	let persona = $derived(data.persona);

	let isAddingToCart = $state(false);
	let cartMessage = $state('');

	async function addToCart() {
		isAddingToCart = true;
		cartMessage = '';

		try {
			const res = await fetch('/api/cart', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ productEntityId: product.entityId }),
			});

			if (!res.ok) throw new Error('Failed to add to cart');

			const result = await res.json();
			cartMessage = `Added to cart (${result.itemCount} items)`;

			getEmitter()?.emit('commerce.add_to_cart', {
				productId: product.id,
				entityId: product.entityId,
				price: product.salePrice || product.price,
				name: product.name,
				category: product.category,
			});

			// Notify layout to refresh cart count
			window.dispatchEvent(new CustomEvent('cart-updated', { detail: { itemCount: result.itemCount } }));

			setTimeout(() => { cartMessage = ''; }, 3000);
		} catch (err) {
			cartMessage = 'Failed to add to cart';
		} finally {
			isAddingToCart = false;
		}
	}
</script>

<svelte:head>
	<title>{product.name} — Haven</title>
	<meta name="description" content={product.descriptionPlain.slice(0, 160)} />
</svelte:head>

<div class="mx-auto max-w-7xl px-6 py-8">
	<!-- Breadcrumb -->
	<nav class="mb-8 text-sm text-surface-muted-fg">
		<a href="/" class="hover:text-surface-fg">Home</a>
		<span class="mx-2">/</span>
		{#if product.categoryPath}
			<a href="/category/{product.categoryPath.replace(/^\/|\/$/g, '').replace('haven-', '')}" class="hover:text-surface-fg">{product.category.replace('Haven ', '')}</a>
			<span class="mx-2">/</span>
		{/if}
		<span class="text-surface-fg">{product.name}</span>
	</nav>

	<!-- Product detail — deterministic structure -->
	<div class="grid gap-12 lg:grid-cols-2">
		<!-- Image -->
		<div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-muted">
			{#if product.image}
				<img
					src={product.image}
					alt={product.imageAlt}
					class="h-full w-full object-cover"
					loading="eager"
				/>
			{/if}
		</div>

		<!-- Details -->
		<div class="flex flex-col">
			<h1 class="text-3xl sm:text-4xl">{product.name}</h1>

			<!-- Price — always visible, always above fold -->
			<div class="mt-4">
				{#if product.salePrice}
					<span class="text-2xl font-medium text-primary">${product.salePrice.toLocaleString()}</span>
					<span class="ml-2 text-lg text-surface-muted-fg line-through">${product.price.toLocaleString()}</span>
					<span class="ml-2 rounded-sm bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary">
						Save ${(product.price - product.salePrice).toLocaleString()}
					</span>
				{:else}
					<span class="text-2xl font-medium">${product.price.toLocaleString()}</span>
				{/if}
			</div>

			<!-- Description -->
			<div class="mt-6 leading-relaxed text-surface-muted-fg prose-sm">
				{@html product.description}
			</div>

			<!-- Specs -->
			{#if Object.keys(product.specs).length > 0}
				<dl class="mt-6 border-t border-surface-border pt-6">
					{#each Object.entries(product.specs) as [key, value]}
						<div class="flex justify-between border-b border-surface-border py-3">
							<dt class="text-sm text-surface-muted-fg">{key}</dt>
							<dd class="text-sm font-medium">{value}</dd>
						</div>
					{/each}
				</dl>
			{/if}

			<!-- Add to Cart — primary CTA, always present -->
			<div class="mt-8">
				<button
					onclick={addToCart}
					disabled={isAddingToCart}
					class="w-full rounded-sm bg-surface-fg py-4 text-sm font-semibold text-surface-bg transition-opacity hover:opacity-85 disabled:opacity-50 sm:w-auto sm:px-12"
				>
					{isAddingToCart ? 'Adding...' : `Add to Cart — $${(product.salePrice || product.price).toLocaleString()}`}
				</button>
				{#if cartMessage}
					<p class="mt-2 text-sm {cartMessage.includes('Failed') ? 'text-error' : 'text-success'}">{cartMessage}</p>
				{/if}
			</div>

			<!-- Persona-conditional extras (30% adaptive zone) -->
			{#if persona === 'gatherer'}
				<!-- Gatherer: editorial cross-sell -->
				<div class="mt-8 border-t border-surface-border pt-8">
					<h3 class="font-display text-lg">Pairs well with</h3>
					<p class="mt-1 text-sm text-surface-muted-fg">Pieces that complement this one.</p>
				</div>
			{:else if persona === 'hunter'}
				<!-- Hunter: practical info -->
				<div class="mt-8 border-t border-surface-border pt-8">
					<h4 class="text-sm font-semibold">Quick facts</h4>
					<ul class="mt-2 space-y-1 text-sm text-surface-muted-fg">
						<li>Free shipping on orders over $500</li>
						<li>30-day returns — we arrange pickup</li>
						<li>5-year warranty on materials and workmanship</li>
					</ul>
				</div>
			{/if}
		</div>
	</div>

	<!-- Related products -->
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

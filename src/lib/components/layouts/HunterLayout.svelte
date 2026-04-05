<script lang="ts">
	import type { Product } from '$lib/types';

	let { category, products }: { category: { name: string; slug: string }; products: Product[] } = $props();

	const sorted = $derived([...products].sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price)));
</script>

<!-- Hunter: Dense, functional, price-first, scannable -->
<div>
	<!-- Compact header with filters -->
	<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-2xl">{category.name}</h1>
			<p class="mt-1 text-sm text-surface-muted-fg">{products.length} items</p>
		</div>
		<div class="flex gap-2">
			<button class="rounded-sm border border-surface-border px-3 py-1.5 text-xs font-medium text-surface-muted-fg transition-colors hover:border-neutral-400 hover:text-surface-fg">
				Filter
			</button>
			<select class="rounded-sm border border-surface-border bg-surface-card px-3 py-1.5 text-xs font-medium text-surface-muted-fg">
				<option>Price: Low to High</option>
				<option>Price: High to Low</option>
				<option>Newest</option>
			</select>
		</div>
	</div>

	<!-- Dense grid -->
	<div class="grid gap-px overflow-hidden rounded-sm border border-surface-border bg-surface-border sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
		{#each sorted as product}
			<a href="/product/{product.id}" class="group flex flex-col bg-surface-card">
				<div class="aspect-square overflow-hidden bg-surface-muted">
					{#if product.image}
						<img
							src={product.image}
							alt={product.imageAlt}
							class="h-full w-full object-cover transition-opacity group-hover:opacity-90"
							loading="lazy"
						/>
					{/if}
				</div>

				<div class="flex flex-1 flex-col p-4">
					<h3 class="text-sm font-medium leading-snug group-hover:text-primary transition-colors">{product.name}</h3>

					{#if Object.keys(product.specs).length > 0}
						<p class="mt-1 text-xs text-surface-muted-fg">
							{Object.values(product.specs).slice(0, 2).join(' · ')}
						</p>
					{/if}

					<div class="mt-auto pt-3">
						{#if product.salePrice}
							<div class="flex items-baseline gap-2">
								<span class="text-base font-semibold text-primary">${product.salePrice}</span>
								<span class="text-xs text-surface-muted-fg line-through">${product.price}</span>
							</div>
						{:else}
							<span class="text-base font-semibold">${product.price}</span>
						{/if}
					</div>

					<button
						onclick={(e) => { e.preventDefault(); e.stopPropagation(); }}
						class="mt-3 w-full rounded-sm bg-surface-fg py-2 text-xs font-medium text-surface-bg transition-opacity hover:opacity-85"
					>
						Add to Cart
					</button>
				</div>
			</a>
		{/each}
	</div>
</div>

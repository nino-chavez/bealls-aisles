<script lang="ts">
	import type { Product } from '$lib/types';

	let {
		columns = 2,
		products,
		imageRatio = 'landscape',
		showDescription = true,
		showSpecs = false,
		showQuickAdd = false,
	}: {
		columns: 2 | 3 | 4;
		products: Product[];
		imageRatio?: 'landscape' | 'square';
		showDescription?: boolean;
		showSpecs?: boolean;
		showQuickAdd?: boolean;
	} = $props();

	const gridClass = $derived(
		columns === 4
			? 'grid gap-px overflow-hidden rounded-sm border border-surface-border bg-surface-border sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
			: columns === 3
				? 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3'
				: 'grid gap-x-6 gap-y-10 sm:grid-cols-2'
	);

	const isCompact = $derived(columns >= 3);
</script>

<div class={gridClass}>
	{#each products as product}
		<a
			href="/product/{product.id}"
			class="group {isCompact ? 'flex flex-col bg-surface-card' : ''}"
		>
			<!-- Image -->
			<div class="overflow-hidden {isCompact ? '' : 'rounded-sm'} bg-surface-muted {imageRatio === 'square' ? 'aspect-square' : 'aspect-[4/3]'}">
				{#if product.image}
					<img
						src={product.image}
						alt={product.imageAlt}
						class="h-full w-full object-cover {isCompact ? 'transition-opacity group-hover:opacity-90' : 'transition-transform duration-500 group-hover:scale-[1.02]'}"
						loading="lazy"
					/>
				{/if}
			</div>

			<!-- Info -->
			<div class="{isCompact ? 'flex flex-1 flex-col p-4' : 'mt-4'}">
				<h3 class="{isCompact ? 'text-sm font-medium leading-snug' : 'font-display text-lg'} group-hover:text-primary transition-colors">
					{product.name}
				</h3>

				{#if showDescription && !isCompact}
					<p class="mt-1.5 line-clamp-2 text-sm leading-relaxed text-surface-muted-fg">{product.description}</p>
				{/if}

				{#if showSpecs && Object.keys(product.specs).length > 0}
					<p class="mt-1 text-xs text-surface-muted-fg">
						{Object.values(product.specs).slice(0, 2).join(' · ')}
					</p>
				{/if}

				<div class="{isCompact ? 'mt-auto pt-3' : 'mt-3'}">
					{#if product.salePrice}
						<div class="flex items-baseline gap-2">
							<span class="{isCompact ? 'text-base font-semibold' : 'font-medium'} text-primary">${product.salePrice.toLocaleString()}</span>
							<span class="text-{isCompact ? 'xs' : 'sm'} text-surface-muted-fg line-through">${product.price.toLocaleString()}</span>
						</div>
					{:else}
						<span class="{isCompact ? 'text-base font-semibold' : 'font-medium'}">${product.price.toLocaleString()}</span>
					{/if}
				</div>

				{#if showQuickAdd}
					<button
						onclick={(e) => { e.preventDefault(); e.stopPropagation(); }}
						class="mt-3 w-full rounded-sm bg-surface-fg py-2 text-xs font-medium text-surface-bg transition-opacity hover:opacity-85"
					>
						Add to Cart
					</button>
				{/if}
			</div>
		</a>
	{/each}
</div>

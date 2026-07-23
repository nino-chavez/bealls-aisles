<script lang="ts">
	import type { Product } from '$lib/types';
	import { addPick, isPicked, removePick } from '$lib/stores/picks.svelte';
	import { formatPrice } from '$lib/brand/pricing';

	let {
		title,
		reasoning,
		products,
	}: {
		title: string;
		reasoning?: string;
		products: Product[];
	} = $props();
</script>

<div class="mb-10">
	<div class="mb-4">
		<p class="text-[10px] font-semibold uppercase tracking-wider text-accent">For you</p>
		<h2 class="mt-1 font-display text-xl tracking-tight sm:text-2xl">{title}</h2>
		{#if reasoning}
			<p class="mt-1 text-sm text-surface-muted-fg">{reasoning}</p>
		{/if}
	</div>

	<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
		{#each products as product}
			{@const fp = formatPrice(product.price, product.salePrice)}
			<a
				href="/product/{product.id}"
				class="group flex flex-col bg-surface-card"
			>
				<div class="relative aspect-square overflow-hidden bg-surface-muted">
					{#if product.image}
						<img
							src={product.image}
							alt={product.imageAlt}
							loading="lazy"
							class="h-full w-full object-cover transition-opacity group-hover:opacity-90"
						/>
					{/if}

					<button
						onclick={(e) => { e.preventDefault(); e.stopPropagation(); isPicked(product.id) ? removePick(product.id) : addPick(product); }}
						class="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full transition-all
							{isPicked(product.id)
								? 'bg-accent text-white shadow-md'
								: 'bg-surface-card/80 text-surface-muted-fg opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-white'}"
						aria-label="{isPicked(product.id) ? 'Remove from' : 'Add to'} picks"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="{isPicked(product.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
					</button>
				</div>

				<div class="flex flex-1 flex-col p-3">
					{#if product.brand}
						<p class="text-[10px] font-semibold uppercase tracking-wider text-surface-muted-fg">{product.brand}</p>
					{/if}
					<h3 class="text-sm font-medium leading-snug group-hover:text-primary transition-colors {product.brand ? 'mt-0.5' : ''}">{product.name}</h3>

					<div class="mt-auto pt-2">
						<div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
							<span class="text-base font-semibold text-primary">{fp.displayPrice}</span>
							{#if fp.comparablePrice}
								<span class="text-xs text-surface-muted-fg">
									{#if fp.comparableLabel}
										{fp.comparableLabel} <span class="line-through">{fp.comparablePrice}</span>
									{:else}
										<span class="line-through">{fp.comparablePrice}</span>
									{/if}
								</span>
							{/if}
						</div>
					</div>
				</div>
			</a>
		{/each}
	</div>
</div>

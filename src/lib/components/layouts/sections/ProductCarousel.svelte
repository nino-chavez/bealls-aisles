<script lang="ts">
	import type { Product } from '$lib/types';
	import { addPick, isPicked, removePick } from '$lib/stores/picks.svelte';
	import { formatPrice } from '$lib/brand/pricing';

	let {
		title,
		products,
		showRating = false,
		showBadges = false,
		showQuickAdd = false,
	}: {
		title: string;
		products: Product[];
		showRating?: boolean;
		showBadges?: boolean;
		showQuickAdd?: boolean;
	} = $props();

	let scrollEl = $state<HTMLDivElement | null>(null);

	function scrollBy(direction: 1 | -1) {
		if (!scrollEl) return;
		const amount = scrollEl.clientWidth * 0.8 * direction;
		scrollEl.scrollBy({ left: amount, behavior: 'smooth' });
	}

	function badgeClass(label: string): string {
		const l = label.toLowerCase();
		if (l === 'new') return 'bg-accent text-white';
		if (l === 'deal' || l === 'sale') return 'bg-primary text-white';
		if (l === 'clearance') return 'bg-error text-white';
		return 'bg-surface-fg text-surface-bg';
	}
</script>

<div class="mb-10">
	<div class="mb-4 flex items-end justify-between">
		<h2 class="font-display text-xl tracking-tight sm:text-2xl">{title}</h2>
		<div class="flex gap-2">
			<button
				onclick={() => scrollBy(-1)}
				aria-label="Scroll left"
				class="flex h-9 w-9 items-center justify-center rounded-full border border-surface-border text-surface-muted-fg transition-colors hover:border-primary hover:text-primary"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
			</button>
			<button
				onclick={() => scrollBy(1)}
				aria-label="Scroll right"
				class="flex h-9 w-9 items-center justify-center rounded-full border border-surface-border text-surface-muted-fg transition-colors hover:border-primary hover:text-primary"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
			</button>
		</div>
	</div>

	<div
		bind:this={scrollEl}
		class="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]"
		style="scroll-snap-type: x mandatory;"
	>
		{#each products as product}
			{@const fp = formatPrice(product.price, product.salePrice)}
			<a
				href="/product/{product.id}"
				class="group flex w-[220px] shrink-0 flex-col overflow-hidden rounded-md bg-surface-card shadow-sm transition-shadow hover:shadow-md sm:w-[240px]"
				style="scroll-snap-align: start;"
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

					{#if showBadges && product.badges && product.badges.length > 0}
						<div class="absolute top-2 left-2 flex flex-col gap-1">
							{#each product.badges as badge}
								<span class="rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider {badgeClass(badge)}">{badge}</span>
							{/each}
						</div>
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

					{#if showRating && typeof product.rating === 'number'}
						<div class="mt-1 flex items-center gap-1 text-xs text-surface-muted-fg">
							<span aria-label="Rating: {product.rating} of 5">
								{#each Array(5) as _, i}
									<span class={i < Math.round(product.rating ?? 0) ? 'text-warning' : 'text-surface-border'}>★</span>
								{/each}
							</span>
							{#if product.reviewCount}<span>({product.reviewCount})</span>{/if}
						</div>
					{/if}

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
						{#if fp.savingsLabel}
							<p class="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
								{fp.savingsLabel}
							</p>
						{/if}
					</div>

					{#if showQuickAdd}
						<button
							onclick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/product/${product.id}`; }}
							class="mt-2 w-full rounded-sm border border-primary py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-white"
						>
							Quick view
						</button>
					{/if}
				</div>
			</a>
		{/each}
	</div>
</div>

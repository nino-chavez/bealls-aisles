<script lang="ts">
	let {
		productName,
		brandLabel,
		price,
		salePrice,
		rating,
		reviewCount,
	}: {
		productName: string;
		brandLabel?: string;
		price: number;
		salePrice?: number;
		rating?: number;
		reviewCount?: number;
	} = $props();

	const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
	let savings = $derived(salePrice && salePrice < price ? price - salePrice : 0);
</script>

<div>
	{#if brandLabel}
		<p class="text-[10px] font-semibold uppercase tracking-wider text-surface-muted-fg">{brandLabel}</p>
	{/if}
	<h1 class="font-display text-3xl tracking-tight sm:text-4xl {brandLabel ? 'mt-1' : ''}">{productName}</h1>

	{#if typeof rating === 'number' && rating > 0}
		<div class="mt-3 flex items-center gap-2 text-sm text-surface-muted-fg">
			<span aria-label="Rating: {rating.toFixed(1)} of 5">
				{#each Array(5) as _, i}
					<span class={i < Math.round(rating) ? 'text-warning' : 'text-surface-border'}>★</span>
				{/each}
			</span>
			<span class="font-medium">{rating.toFixed(1)}</span>
			{#if reviewCount}
				<a href="#reviews" class="hover:text-primary">({reviewCount.toLocaleString()} reviews)</a>
			{/if}
		</div>
	{/if}

	<div class="mt-4 flex items-baseline flex-wrap gap-x-3 gap-y-1">
		{#if salePrice && salePrice < price}
			<span class="text-2xl font-medium text-primary">{fmt(salePrice)}</span>
			<span class="text-lg text-surface-muted-fg line-through">{fmt(price)}</span>
			<span class="rounded-sm bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary">
				Save {fmt(savings)}
			</span>
		{:else}
			<span class="text-2xl font-medium">{fmt(price)}</span>
		{/if}
	</div>
</div>

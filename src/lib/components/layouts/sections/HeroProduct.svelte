<script lang="ts">
	import type { Product } from '$lib/types';
	import { formatPrice } from '$lib/brand/pricing';

	let { product, showSpecs = true }: { product: Product; showSpecs?: boolean } = $props();
	const fp = $derived(formatPrice(product.price, product.salePrice));
</script>

<a href="/product/{product.id}" class="group mb-12 block border-b border-surface-border pb-12">
	<div class="grid gap-8 lg:grid-cols-5">
		<div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-muted lg:col-span-3">
			{#if product.image}
				<img
					src={product.image}
					alt={product.imageAlt}
					width={800}
					height={600}
					decoding="async"
					fetchpriority="high"
					class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
				/>
			{/if}
		</div>

		<div class="flex flex-col justify-center lg:col-span-2">
			<p class="text-xs font-medium uppercase tracking-widest text-primary">Featured</p>
			<h2 class="mt-3 font-display text-2xl sm:text-3xl">{product.name}</h2>
			<p class="mt-4 leading-relaxed text-surface-muted-fg">{product.description}</p>

			{#if showSpecs && Object.keys(product.specs).length > 0}
				<dl class="mt-6 grid grid-cols-2 gap-x-6 gap-y-2">
					{#each Object.entries(product.specs).slice(0, 4) as [key, value]}
						<div>
							<dt class="text-xs text-surface-muted-fg">{key}</dt>
							<dd class="text-sm font-medium">{value}</dd>
						</div>
					{/each}
				</dl>
			{/if}

			<div class="mt-6">
				<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<span class="text-xl font-medium text-primary">{fp.displayPrice}</span>
					{#if fp.comparablePrice}
						<span class="text-sm text-surface-muted-fg">
							{#if fp.comparableLabel}
								{fp.comparableLabel} <span class="line-through">{fp.comparablePrice}</span>
							{:else}
								<span class="line-through">{fp.comparablePrice}</span>
							{/if}
						</span>
					{/if}
				</div>
				{#if fp.savingsLabel}
					<p class="mt-1 text-xs font-semibold uppercase tracking-wider text-primary">
						{fp.savingsLabel}
					</p>
				{/if}
			</div>

			<span class="mt-6 text-sm font-medium text-primary group-hover:underline">View details &rarr;</span>
		</div>
	</div>
</a>

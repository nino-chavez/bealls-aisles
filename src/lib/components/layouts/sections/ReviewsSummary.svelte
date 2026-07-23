<script lang="ts">
	let {
		avgRating,
		reviewCount,
		histogram,
		writeReviewHref = '#write-review',
	}: {
		avgRating: number;
		reviewCount: number;
		/** Length-5 array indexed by stars - 1 (index 0 = 1 star, index 4 = 5 stars). */
		histogram: number[];
		writeReviewHref?: string;
	} = $props();

	let total = $derived(histogram.reduce((sum, n) => sum + n, 0) || 1);
	let rounded = $derived(Math.round(avgRating * 10) / 10);
</script>

<section id="reviews" class="border-t border-surface-border pt-8" aria-label="Reviews summary">
	<div class="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h2 class="font-display text-2xl">Customer reviews</h2>
			<div class="mt-2 flex items-baseline gap-3">
				<span class="text-4xl font-medium" aria-label="Average rating: {rounded.toFixed(1)} of 5">
					{rounded.toFixed(1)}
				</span>
				<span aria-hidden="true" class="text-warning">
					{#each Array(5) as _, i}
						<span class={i < Math.round(rounded) ? 'text-warning' : 'text-surface-border'}>★</span>
					{/each}
				</span>
				<span class="text-sm text-surface-muted-fg">
					{reviewCount.toLocaleString()} {reviewCount === 1 ? 'review' : 'reviews'}
				</span>
			</div>
		</div>

		<a
			href={writeReviewHref}
			class="inline-flex items-center justify-center rounded-sm border border-surface-border px-5 py-2.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
		>
			Write a review
		</a>
	</div>

	<div class="mt-6 max-w-md space-y-1.5">
		{#each [5, 4, 3, 2, 1] as stars}
			{@const count = histogram[stars - 1] ?? 0}
			{@const pct = (count / total) * 100}
			<div class="flex items-center gap-3 text-xs text-surface-muted-fg">
				<span class="w-12 text-right">{stars} star</span>
				<div class="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
					<div class="h-full bg-warning" style="width: {pct}%"></div>
				</div>
				<span class="w-10 text-right tabular-nums">{count}</span>
			</div>
		{/each}
	</div>
</section>

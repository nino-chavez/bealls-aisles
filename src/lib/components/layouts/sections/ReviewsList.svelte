<script lang="ts">
	type Review = {
		id: string;
		author: string;
		date: string;
		rating: number;
		title?: string;
		body: string;
		helpful?: number;
		verifiedPurchase?: boolean;
	};

	let {
		reviews,
		filters,
	}: {
		reviews: Review[];
		filters?: { sort?: 'recent' | 'helpful' | 'highest' | 'lowest' };
	} = $props();

	let sort = $state<'recent' | 'helpful' | 'highest' | 'lowest'>(filters?.sort ?? 'recent');

	let sorted = $derived.by(() => {
		const list = [...reviews];
		switch (sort) {
			case 'helpful':
				return list.sort((a, b) => (b.helpful ?? 0) - (a.helpful ?? 0));
			case 'highest':
				return list.sort((a, b) => b.rating - a.rating);
			case 'lowest':
				return list.sort((a, b) => a.rating - b.rating);
			case 'recent':
			default:
				return list.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
		}
	});
</script>

{#if reviews.length > 0}
	<section class="pt-6" aria-label="Reviews list">
		<div class="mb-6 flex items-center justify-between">
			<p class="text-sm text-surface-muted-fg">Showing {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</p>
			<label class="flex items-center gap-2 text-sm">
				<span class="text-surface-muted-fg">Sort by</span>
				<select
					value={sort}
					onchange={(e) => (sort = (e.currentTarget as HTMLSelectElement).value as typeof sort)}
					class="rounded-sm border border-surface-border bg-surface-card px-2 py-1.5 text-sm"
				>
					<option value="recent">Most recent</option>
					<option value="helpful">Most helpful</option>
					<option value="highest">Highest rated</option>
					<option value="lowest">Lowest rated</option>
				</select>
			</label>
		</div>

		<ul class="divide-y divide-surface-border">
			{#each sorted as review (review.id)}
				<li class="py-5">
					<div class="flex items-start justify-between gap-4">
						<div>
							<div class="flex items-center gap-2 text-sm">
								<span aria-hidden="true" class="text-warning">
									{#each Array(5) as _, i}
										<span class={i < review.rating ? 'text-warning' : 'text-surface-border'}>★</span>
									{/each}
								</span>
								{#if review.title}
									<span class="font-medium">{review.title}</span>
								{/if}
							</div>
							<p class="mt-1 text-xs text-surface-muted-fg">
								{review.author} · {new Date(review.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
								{#if review.verifiedPurchase}
									<span class="ml-1 rounded-sm bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">Verified buyer</span>
								{/if}
							</p>
						</div>
						{#if review.helpful}
							<span class="shrink-0 text-xs text-surface-muted-fg">{review.helpful} found this helpful</span>
						{/if}
					</div>
					<p class="mt-3 text-sm leading-relaxed text-surface-muted-fg">{review.body}</p>
				</li>
			{/each}
		</ul>
	</section>
{/if}

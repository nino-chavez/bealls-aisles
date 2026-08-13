<script lang="ts">
	/** Fixed rescue shell. Named rescue zones currently terminate Hidden. */
	let {
		reason,
		persona = 'gatherer',
		categories = [],
	}: {
		reason: 'not-found' | 'empty-cart' | 'empty-search' | 'empty-wishlist';
		persona?: string;
		categories?: Array<{ slug: string; name: string }>;
	} = $props();
</script>

<div data-rescue-reason={reason} data-rescue-persona={persona}>
	{#if categories.length > 0}
		<section>
			<h2 class="font-display text-2xl tracking-tight">Browse by category</h2>
			<div class="mt-6 grid gap-px overflow-hidden rounded-sm border border-surface-border bg-surface-border sm:grid-cols-2 lg:grid-cols-4">
				{#each categories.slice(0, 4) as cat}
					<a
						href="/category/{cat.slug}"
						class="group relative flex flex-col justify-end bg-surface-card p-6 transition-colors hover:bg-surface-muted"
						style="min-height: 140px;"
					>
						<h3 class="font-display text-lg">{cat.name}</h3>
						<span class="mt-1 text-sm text-primary group-hover:underline">Browse &rarr;</span>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<div class="mt-10 text-center">
		<a
			href="/"
			class="inline-flex items-center rounded-sm bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
		>
			Go to homepage
		</a>
	</div>
</div>

<script lang="ts">
	let {
		columns,
		tiers,
	}: {
		columns: 2 | 3 | 4;
		tiers: Array<{ label: string; image: string; href: string; savingsBadge?: string }>;
	} = $props();

	const gridClass = $derived(
		columns === 4
			? 'grid gap-3 grid-cols-2 lg:grid-cols-4'
			: columns === 3
				? 'grid gap-3 grid-cols-1 sm:grid-cols-3'
				: 'grid gap-3 grid-cols-1 sm:grid-cols-2'
	);
</script>

<div class="mb-10 {gridClass}">
	{#each tiers as tier}
		<a
			href={tier.href}
			class="group relative block overflow-hidden rounded-sm bg-surface-muted"
		>
			<div class="aspect-[5/3]">
				{#if tier.image}
					<img
						src={tier.image}
						alt={tier.label}
						class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
						loading="lazy"
					/>
				{/if}
			</div>

			<!-- Bold price overlay (Bealls pattern) -->
			<div class="absolute inset-0 flex items-center justify-end p-6 sm:p-8">
				<div class="text-right">
					<p class="font-display text-3xl font-bold text-surface-fg drop-shadow-md sm:text-4xl">
						{tier.label}
					</p>
					{#if tier.savingsBadge}
						<p class="mt-1 text-xs font-semibold uppercase tracking-wider text-primary drop-shadow-sm">
							{tier.savingsBadge}
						</p>
					{/if}
					<span class="mt-2 inline-block text-xs font-medium uppercase tracking-wider text-surface-fg underline-offset-4 group-hover:underline">
						Shop Now
					</span>
				</div>
			</div>
		</a>
	{/each}
</div>

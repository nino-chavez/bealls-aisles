<script lang="ts">
	let {
		columns = 4,
		callouts,
	}: {
		columns?: 3 | 4;
		callouts: Array<{ icon: string; label: string; body?: string }>;
	} = $props();

	const colClass = $derived(
		columns === 3
			? 'grid-cols-1 sm:grid-cols-3'
			: 'grid-cols-2 sm:grid-cols-4'
	);
</script>

<div class="mb-10 rounded-sm border border-surface-muted bg-surface-muted/30 px-6 py-6 sm:px-8 sm:py-8">
	<div class="grid gap-6 {colClass}">
		{#each callouts as c (c.label)}
			<div class="flex flex-col items-center gap-1.5 text-center">
				<span class="text-2xl" aria-hidden="true">{c.icon}</span>
				<p class="text-xs font-semibold uppercase tracking-wider text-surface-fg sm:text-sm">{c.label}</p>
				{#if c.body}
					<p class="text-[11px] leading-relaxed text-surface-muted-fg sm:text-xs">{c.body}</p>
				{/if}
			</div>
		{/each}
	</div>
</div>

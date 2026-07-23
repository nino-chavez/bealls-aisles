<script lang="ts">
	let {
		eyebrow = '',
		headline,
		ctaLabel = '',
		ctaHref = '',
		urgency = 'soft',
	}: {
		eyebrow?: string;
		headline: string;
		ctaLabel?: string;
		ctaHref?: string;
		urgency?: 'none' | 'soft' | 'hard';
	} = $props();

	const surfaceClass = $derived(
		urgency === 'hard'
			? 'bg-primary text-white'
			: urgency === 'soft'
				? 'bg-accent text-white'
				: 'bg-surface-muted text-surface-fg'
	);

	const ctaClass = $derived(
		urgency === 'none'
			? 'bg-surface-fg text-surface-bg'
			: 'bg-white text-surface-fg'
	);
</script>

<div class="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-sm px-6 py-4 {surfaceClass}">
	<div class="flex flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
		{#if eyebrow}
			<span class="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">{eyebrow}</span>
		{/if}
		<p class="text-sm font-medium sm:text-base">{headline}</p>
	</div>

	{#if ctaLabel}
		<a
			href={ctaHref || '#'}
			class="inline-flex items-center justify-center rounded-sm px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-opacity hover:opacity-85 {ctaClass}"
		>
			{ctaLabel}
		</a>
	{/if}
</div>

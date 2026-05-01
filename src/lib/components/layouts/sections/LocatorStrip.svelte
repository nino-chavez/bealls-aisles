<script lang="ts">
	let {
		eyebrow = '',
		headline,
		body = '',
		ctaLabel,
		ctaHref,
	}: {
		eyebrow?: string;
		headline: string;
		body?: string;
		ctaLabel: string;
		ctaHref: string;
	} = $props();
</script>

<div class="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-sm bg-surface-fg px-6 py-4 text-surface-bg">
	<div class="flex flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
		{#if eyebrow}
			<span class="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">{eyebrow}</span>
		{/if}
		<p class="text-sm font-medium sm:text-base">
			<span aria-hidden="true">📍</span> {headline}
		</p>
		{#if body}
			<span class="text-xs opacity-80">{body}</span>
		{/if}
	</div>

	<a
		href={ctaHref}
		class="inline-flex items-center justify-center rounded-sm bg-surface-bg px-4 py-2 text-xs font-semibold uppercase tracking-wider text-surface-fg transition-opacity hover:opacity-90"
	>
		{ctaLabel}
	</a>
</div>

<script lang="ts">
	let {
		sectionLabel = '',
		headline,
		image,
		ctaLabel,
		ctaHref,
	}: {
		sectionLabel?: string;
		headline: string;
		image: string;
		ctaLabel: string;
		ctaHref: string;
	} = $props();
</script>

<a
	href={ctaHref}
	class="mb-10 block overflow-hidden rounded-sm group"
>
	<div class="relative aspect-[16/7] bg-surface-muted">
		{#if image}
			<img
				src={image}
				alt={headline}
				class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
				loading="lazy"
			/>
		{/if}
		<div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent"></div>

		<div class="absolute inset-0 flex flex-col items-start justify-end gap-2 p-8 text-white sm:p-12">
			{#if sectionLabel}
				<span class="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-90">{sectionLabel}</span>
			{/if}
			<h2 class="font-display text-3xl leading-tight tracking-tight drop-shadow-md sm:text-4xl">
				{headline}
			</h2>
			<span class="mt-2 inline-flex items-center text-xs font-semibold uppercase tracking-wider underline underline-offset-4">
				{ctaLabel} →
			</span>
		</div>
	</div>
</a>

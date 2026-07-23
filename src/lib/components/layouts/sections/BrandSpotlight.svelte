<script lang="ts">
	let {
		brandName,
		eyebrow = 'Featured Brand',
		headline,
		body,
		image,
		ctaLabel = '',
		ctaHref = '',
	}: {
		brandName: string;
		eyebrow?: string;
		headline: string;
		body: string;
		image: string;
		ctaLabel?: string;
		ctaHref?: string;
	} = $props();
</script>

<div class="mb-10 grid gap-0 overflow-hidden rounded-sm border border-surface-muted bg-surface-bg sm:grid-cols-2">
	<div class="relative aspect-[4/3] bg-surface-muted sm:aspect-auto">
		{#if image}
			<img
				src={image}
				alt={brandName}
				class="absolute inset-0 h-full w-full object-cover"
				loading="lazy"
			/>
		{/if}
	</div>

	<div class="flex flex-col justify-center gap-3 p-8 sm:p-10">
		<span class="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">{eyebrow}</span>
		<p class="font-display text-2xl font-semibold leading-tight text-surface-fg sm:text-3xl">
			{brandName}
		</p>
		<h3 class="text-base font-semibold leading-snug text-surface-fg sm:text-lg">{headline}</h3>
		<p class="text-sm leading-relaxed text-surface-muted-fg">{body}</p>
		{#if ctaLabel}
			<a
				href={ctaHref || '#'}
				class="mt-2 inline-flex w-fit items-center text-xs font-semibold uppercase tracking-wider text-surface-fg underline underline-offset-4 transition-opacity hover:opacity-80"
			>
				{ctaLabel} →
			</a>
		{/if}
	</div>
</div>

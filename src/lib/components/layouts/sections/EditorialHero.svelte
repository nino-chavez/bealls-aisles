<script lang="ts">
	let {
		image,
		eyebrow = '',
		headline,
		body = '',
		ctaLabel = '',
		ctaHref = '',
		textPosition = 'center',
	}: {
		image: string;
		eyebrow?: string;
		headline: string;
		body?: string;
		ctaLabel?: string;
		ctaHref?: string;
		textPosition?: 'left' | 'center' | 'right';
	} = $props();

	const positionClass = $derived(
		textPosition === 'left'
			? 'justify-start text-left items-center'
			: textPosition === 'right'
				? 'justify-end text-right items-center'
				: 'justify-center text-center items-center'
	);

	const innerWidthClass = $derived(
		textPosition === 'center' ? 'max-w-2xl' : 'max-w-md'
	);
</script>

<div class="relative mb-10 overflow-hidden rounded-sm bg-surface-muted">
	<div class="aspect-[16/9] sm:aspect-[16/7]">
		{#if image}
			<img
				src={image}
				alt={headline}
				class="h-full w-full object-cover"
				loading="lazy"
			/>
		{/if}
	</div>

	<div class="absolute inset-0 flex {positionClass} bg-gradient-to-r from-black/30 via-black/10 to-transparent p-8 sm:p-12">
		<div class="{innerWidthClass} text-white">
			{#if eyebrow}
				<p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] opacity-90">{eyebrow}</p>
			{/if}
			<h2 class="font-display text-3xl leading-tight tracking-tight drop-shadow-md sm:text-5xl">
				{headline}
			</h2>
			{#if body}
				<p class="mt-3 text-sm leading-relaxed opacity-95 sm:text-base">{body}</p>
			{/if}
			{#if ctaLabel}
				<a
					href={ctaHref || '#'}
					class="mt-5 inline-block text-xs font-semibold uppercase tracking-wider underline underline-offset-4 transition-opacity hover:opacity-80"
				>
					{ctaLabel}
				</a>
			{/if}
		</div>
	</div>
</div>

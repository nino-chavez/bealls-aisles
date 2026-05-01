<script lang="ts">
	let {
		images,
		productName,
	}: {
		images: Array<{ url: string; alt: string }>;
		productName: string;
	} = $props();

	let activeIndex = $state(0);
	let active = $derived(images[activeIndex] ?? images[0]);
</script>

<div class="flex flex-col gap-4">
	<div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-muted">
		{#if active?.url}
			<img
				src={active.url}
				alt={active.alt || productName}
				class="h-full w-full object-cover"
				loading="eager"
			/>
		{/if}
	</div>

	{#if images.length > 1}
		<div class="grid grid-cols-5 gap-2">
			{#each images as img, idx}
				<button
					type="button"
					onclick={() => (activeIndex = idx)}
					aria-label="Show image {idx + 1} of {images.length}"
					aria-pressed={idx === activeIndex}
					class="aspect-square overflow-hidden rounded-sm border-2 transition-colors
						{idx === activeIndex
							? 'border-primary'
							: 'border-transparent hover:border-surface-border'}"
				>
					{#if img.url}
						<img src={img.url} alt={img.alt || productName} class="h-full w-full object-cover" loading="lazy" />
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

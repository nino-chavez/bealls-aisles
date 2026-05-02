<script lang="ts">
	/**
	 * cluster-chip-row — themed merchandising bins on PLP.
	 *
	 * Real-Bealls signature pattern: 3–8 curated themes ("BOHEMIAN ROMANCE",
	 * "VACATION OUTFITS", "RODEO STYLE") shown as a row of chip-style links
	 * above the product grid. Each chip spans subcategories. Per the brand
	 * voice rule (REAL-BEALLS-REFERENCE.md §4.1) labels render in
	 * TRACKING-WIDE UPPERCASE.
	 *
	 * Section label, when present, renders sentence-case lowercase
	 * ("outfit collections") to match the brand's editorial voice.
	 */

	let {
		sectionLabel,
		chips,
	}: {
		sectionLabel?: string;
		chips: Array<{ label: string; href: string }>;
	} = $props();
</script>

<section class="border-y border-surface-border py-4">
	{#if sectionLabel}
		<p class="mb-2 px-6 text-sm text-surface-muted-fg">{sectionLabel}</p>
	{/if}
	<ul class="flex flex-wrap items-stretch gap-x-6 gap-y-3 px-6">
		{#each chips as chip}
			<li>
				<a
					href={chip.href}
					class="inline-block py-1 text-xs font-semibold uppercase tracking-[0.18em] text-surface-fg underline decoration-1 underline-offset-[6px] transition-colors hover:text-primary"
				>
					{chip.label}
				</a>
			</li>
		{/each}
	</ul>
</section>

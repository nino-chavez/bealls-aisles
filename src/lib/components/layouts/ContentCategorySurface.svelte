<script lang="ts">
	import EditorialHero from './sections/EditorialHero.svelte';
	import PromoStrip from './sections/PromoStrip.svelte';
	import CategoryTileGrid from './sections/CategoryTileGrid.svelte';

	let {
		category,
		brandPillars,
		heroImage,
		heroBody,
		heroEyebrow,
		locatorCta,
		locatorBody,
	}: {
		category: { slug: string; name: string; description: string };
		brandPillars: Array<{ label: string; image: string; href: string }>;
		heroImage: string;
		heroBody: string;
		heroEyebrow: string;
		locatorCta: string;
		locatorBody: string;
	} = $props();

</script>

<div class="mx-auto max-w-7xl px-6 py-8">
	<div class="relative" data-fixed-section="content-category.hero">
		<EditorialHero
			image={heroImage}
			eyebrow={heroEyebrow}
			headline={category.name}
			body={heroBody}
			ctaLabel={locatorCta}
			ctaHref="#locator"
			textPosition="left"
		/>
	</div>
	<div class="relative" data-fixed-section="content-category.store-message">
		<PromoStrip
			eyebrow="IN STORE"
			headline={locatorBody}
			ctaLabel="Find a Store"
			ctaHref="#locator"
			urgency="soft"
		/>
	</div>
	<div class="relative" data-fixed-section="content-category.pillars">
		<CategoryTileGrid sectionLabel="More to explore in store" columns={4} tiles={brandPillars} />
	</div>
</div>

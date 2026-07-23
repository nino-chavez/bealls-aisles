<script lang="ts">
	import LayoutRenderer from './LayoutRenderer.svelte';
	import type { Layout } from '$lib/schema/layout';

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

	const layout: Layout = $derived({
		persona: 'gatherer',
		reasoning: 'Content-mode category surface — drives in-store discovery, no transactional flow.',
		productOrder: [],
		sections: [
			{
				component: 'editorial-hero',
				props: {
					image: heroImage,
					eyebrow: heroEyebrow,
					headline: category.name,
					body: heroBody,
					ctaLabel: locatorCta,
					ctaHref: '#locator',
					textPosition: 'left',
				},
			},
			{
				component: 'promo-strip',
				props: {
					eyebrow: 'IN STORE',
					headline: locatorBody,
					ctaLabel: 'Find a Store',
					ctaHref: '#locator',
					urgency: 'soft',
				},
			},
			{
				component: 'category-tile-grid',
				props: {
					sectionLabel: 'More to explore in store',
					columns: 4,
					tiles: brandPillars,
				},
			},
		],
	});
</script>

<div class="mx-auto max-w-7xl px-6 py-8">
	<LayoutRenderer {layout} products={[]} />
</div>

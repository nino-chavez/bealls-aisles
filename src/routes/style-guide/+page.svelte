<script lang="ts">
	import LayoutRenderer from '$lib/components/layouts/LayoutRenderer.svelte';
	import type { Layout } from '$lib/schema/layout';
	import type { Product } from '$lib/types';

	let { data } = $props();
	const brand = $derived(data.brand);

	// Curated mini-fixtures for component samples.
	const sampleProducts: Product[] = [
		{
			id: 'sg1',
			entityId: 90001,
			name: 'Sample Top',
			brand: 'Joie De Vivre',
			price: 20,
			salePrice: 9.99,
			image: 'https://picsum.photos/seed/sg1/600/600',
			imageAlt: 'Top',
			description: 'Soft modal blend, easy drape.',
			specs: { material: 'Modal', sleeve: 'Short' },
			tags: [],
			category: 'tops',
			rating: 4.5,
			reviewCount: 128,
			badges: ['New', 'Deal'],
		},
		{
			id: 'sg2',
			entityId: 90002,
			name: 'Sample Shorts',
			brand: 'Dash',
			price: 28,
			salePrice: 14.99,
			image: 'https://picsum.photos/seed/sg2/600/600',
			imageAlt: 'Shorts',
			description: 'Stretch poplin, deep pockets.',
			specs: { material: 'Cotton blend', inseam: '11"' },
			tags: [],
			category: 'bottoms',
			rating: 4.8,
			reviewCount: 412,
			badges: ['Deal'],
		},
		{
			id: 'sg3',
			entityId: 90003,
			name: 'Sample Dress',
			brand: 'Love Scarlett',
			price: 22,
			salePrice: 10.99,
			image: 'https://picsum.photos/seed/sg3/600/600',
			imageAlt: 'Dress',
			description: 'Wrap silhouette, vibrant print.',
			specs: { material: 'Rayon', length: 'Midi' },
			tags: [],
			category: 'dresses',
			rating: 4.2,
			reviewCount: 67,
			badges: ['New'],
		},
		{
			id: 'sg4',
			entityId: 90004,
			name: 'Sample Bag',
			brand: 'Coastal Hand',
			price: 39,
			salePrice: 19.99,
			image: 'https://picsum.photos/seed/sg4/600/600',
			imageAlt: 'Bag',
			description: 'Hand-finished crochet.',
			specs: { material: 'Cotton', strap: 'Adjustable' },
			tags: [],
			category: 'accessories',
			rating: 4.6,
			reviewCount: 203,
			badges: ['Clearance'],
		},
	];

	// Each layout-component sample is its own mini layout for visual isolation.
	function makeSampleLayout(component: string): Layout {
		const base = { persona: 'hunter' as const, reasoning: 'Style guide sample.', productOrder: ['sg1','sg2','sg3','sg4'] };
		switch (component) {
			case 'promo-strip':
				return { ...base, sections: [{ component: 'promo-strip', props: { eyebrow: 'TODAY ONLY', headline: 'Free shipping on orders $99+', ctaLabel: 'Shop Now', ctaHref: '#', urgency: 'hard' } }] };
			case 'editorial-hero':
				return { ...base, sections: [{ component: 'editorial-hero', props: { image: 'https://picsum.photos/seed/sghero/1600/600', eyebrow: 'NEW SEASON', headline: brand.homepage.heroHeadline, body: brand.homepage.heroBody, ctaLabel: 'Shop the Edit', ctaHref: '#', textPosition: 'left' } }] };
			case 'editorial-header':
				return { ...base, sections: [{ component: 'editorial-header', props: { eyebrow: 'EDITORIAL', headline: brand.homepage.editorialHeadline, body: brand.homepage.editorialBody } }] };
			case 'category-tile-grid':
				return { ...base, sections: [{ component: 'category-tile-grid', props: { sectionLabel: 'Shop by Category', columns: 4, tiles: brand.categories.slice(0, 4).map((c, i) => ({ label: c.displayName, image: `https://picsum.photos/seed/sgcat${i}/600/450`, href: `/c/${c.slug}` })) } }] };
			case 'price-rail':
				return { ...base, sections: [{ component: 'price-rail', props: { columns: 2, tiers: [{ label: 'Under $25', image: 'https://picsum.photos/seed/sgt1/800/500', href: '#', savingsBadge: 'Up to 60% off' }, { label: 'Under $50', image: 'https://picsum.photos/seed/sgt2/800/500', href: '#', savingsBadge: 'Up to 70% off' }] } }] };
			case 'category-header':
				return { ...base, sections: [{ component: 'category-header', props: { title: 'Women / Tops', subtitle: '124 results', showSort: true, showFilter: true, subcategories: brand.categories.slice(0, 4).map(c => ({ label: c.displayName, href: `/c/${c.slug}` })) } }] };
			case 'product-grid':
				return { ...base, sections: [{ component: 'product-grid', props: { columns: 4, imageRatio: 'square', showDescription: false, showSpecs: false, showQuickAdd: true, showRating: true, showBadges: true, products: sampleProducts.map(p => ({ productId: p.id, role: 'standard' as const })) } }] };
			case 'product-carousel':
				return { ...base, sections: [{ component: 'product-carousel', props: { title: 'Best Sellers', products: sampleProducts.map(p => ({ productId: p.id, role: 'standard' as const })), showRating: true, showBadges: true, showQuickAdd: true } }] };
			case 'coupon-strip':
				return { ...base, sections: [{ component: 'coupon-strip', props: { eyebrow: 'OFFER FOR YOU', headline: 'Get $10 off when you spend $80+', body: 'Code applies in cart. One per customer.', code: 'SAVE10', ctaLabel: 'Get Code' } }] };
			case 'lifestyle-price-hero':
				return { ...base, sections: [{ component: 'lifestyle-price-hero', props: { image: 'https://picsum.photos/seed/sglh/1600/600', category: 'Handbags', priceLabel: 'starting at $19.99', ctaLabel: 'Shop Bags', ctaHref: '#' } }] };
			case 'bealls-bucks-callout':
				return { ...base, sections: [{ component: 'bealls-bucks-callout', props: { mode: 'earn', amount: 5, unit: brand.incentives?.loyalty?.unit || 'points', threshold: 100 } }] };
			case 'hero-product':
				return { ...base, sections: [{ component: 'hero-product', props: { product: { productId: 'sg4', role: 'hero' }, showSpecs: true } }] };
			default:
				return { ...base, sections: [] };
		}
	}

	const storefrontComponents = ['promo-strip', 'editorial-hero', 'editorial-header', 'category-tile-grid', 'price-rail', 'category-header', 'product-grid', 'product-carousel', 'coupon-strip', 'lifestyle-price-hero', 'bealls-bucks-callout', 'hero-product'];
	const contentComponents = ['promo-strip', 'editorial-hero', 'editorial-header', 'category-tile-grid', 'category-header', 'bealls-bucks-callout'];

	const componentList = $derived(brand.mode === 'content' ? contentComponents : storefrontComponents);
</script>

<svelte:head>
	<title>{brand.name} — Style Guide</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-6 py-12">
	<!-- HEADER -->
	<header class="mb-12 border-b border-surface-border pb-8">
		<p class="text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">Brand Style Guide · {brand.mode} mode</p>
		<h1 class="mt-3 font-display text-5xl tracking-tight">{brand.name}</h1>
		<p class="mt-3 text-lg italic text-surface-muted-fg">{brand.tagline}</p>
		<p class="mt-3 max-w-2xl text-sm leading-relaxed text-surface-muted-fg">{brand.domain}</p>
	</header>

	<!-- COLORS -->
	<section class="mb-16">
		<h2 class="font-display text-3xl tracking-tight">Color System</h2>
		<p class="mt-2 text-sm text-surface-muted-fg">Brand and surface tokens injected into <code class="rounded bg-surface-muted px-1 py-0.5 font-mono text-xs">:root</code> as CSS custom properties. Components use semantic Tailwind classes that resolve to these values.</p>

		<h3 class="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">Brand</h3>
		<div class="mt-3 grid gap-3 sm:grid-cols-3">
			<div class="overflow-hidden rounded-sm border border-surface-border">
				<div class="h-24 bg-primary"></div>
				<div class="p-3">
					<p class="text-sm font-semibold">Primary</p>
					<p class="font-mono text-xs text-surface-muted-fg">{brand.theme.primary}</p>
				</div>
			</div>
			<div class="overflow-hidden rounded-sm border border-surface-border">
				<div class="h-24 bg-secondary"></div>
				<div class="p-3">
					<p class="text-sm font-semibold">Secondary</p>
					<p class="font-mono text-xs text-surface-muted-fg">{brand.theme.secondary}</p>
				</div>
			</div>
			<div class="overflow-hidden rounded-sm border border-surface-border">
				<div class="h-24 bg-accent"></div>
				<div class="p-3">
					<p class="text-sm font-semibold">Accent</p>
					<p class="font-mono text-xs text-surface-muted-fg">{brand.theme.accent}</p>
				</div>
			</div>
		</div>

		<h3 class="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">Surfaces</h3>
		<div class="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
			<div class="overflow-hidden rounded-sm border border-surface-border">
				<div class="h-16" style="background: {brand.theme.surfaceBg};"></div>
				<div class="p-3"><p class="text-sm font-semibold">Background</p><p class="font-mono text-xs text-surface-muted-fg">{brand.theme.surfaceBg}</p></div>
			</div>
			<div class="overflow-hidden rounded-sm border border-surface-border">
				<div class="h-16" style="background: {brand.theme.surfaceCard};"></div>
				<div class="p-3"><p class="text-sm font-semibold">Card</p><p class="font-mono text-xs text-surface-muted-fg">{brand.theme.surfaceCard}</p></div>
			</div>
			<div class="overflow-hidden rounded-sm border border-surface-border">
				<div class="h-16" style="background: {brand.theme.surfaceMuted};"></div>
				<div class="p-3"><p class="text-sm font-semibold">Muted</p><p class="font-mono text-xs text-surface-muted-fg">{brand.theme.surfaceMuted}</p></div>
			</div>
			<div class="overflow-hidden rounded-sm border border-surface-border">
				<div class="h-16" style="background: {brand.theme.surfaceBorder};"></div>
				<div class="p-3"><p class="text-sm font-semibold">Border</p><p class="font-mono text-xs text-surface-muted-fg">{brand.theme.surfaceBorder}</p></div>
			</div>
		</div>

		<h3 class="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">Foreground</h3>
		<div class="mt-3 grid gap-3 sm:grid-cols-3">
			<div class="rounded-sm border border-surface-border p-4">
				<p class="text-base" style="color: {brand.theme.surfaceFg};">Surface foreground</p>
				<p class="mt-1 font-mono text-xs text-surface-muted-fg">{brand.theme.surfaceFg}</p>
			</div>
			<div class="rounded-sm border border-surface-border p-4">
				<p class="text-base" style="color: {brand.theme.surfaceCardFg};">Card foreground</p>
				<p class="mt-1 font-mono text-xs text-surface-muted-fg">{brand.theme.surfaceCardFg}</p>
			</div>
			<div class="rounded-sm border border-surface-border p-4">
				<p class="text-base" style="color: {brand.theme.surfaceMutedFg};">Muted foreground</p>
				<p class="mt-1 font-mono text-xs text-surface-muted-fg">{brand.theme.surfaceMutedFg}</p>
			</div>
		</div>
	</section>

	<!-- TYPOGRAPHY -->
	<section class="mb-16">
		<h2 class="font-display text-3xl tracking-tight">Typography</h2>
		<p class="mt-2 text-sm text-surface-muted-fg">Loaded via <code class="rounded bg-surface-muted px-1 py-0.5 font-mono text-xs">{brand.googleFontsUrl}</code></p>

		<div class="mt-8 grid gap-6 lg:grid-cols-2">
			<div class="rounded-sm border border-surface-border p-6">
				<p class="text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">Display</p>
				<p class="mt-2 font-mono text-xs text-surface-muted-fg">{brand.theme.fontDisplay}</p>
				<p class="mt-6 font-display text-5xl leading-tight">{brand.homepage.heroHeadline}</p>
				<p class="mt-3 font-display text-3xl">{brand.homepage.editorialHeadline}</p>
				<p class="mt-3 font-display text-xl">Section heading</p>
				<p class="mt-4 text-xs text-surface-muted-fg">Used for: hero headlines, section titles, editorial framing</p>
			</div>

			<div class="rounded-sm border border-surface-border p-6">
				<p class="text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">Body</p>
				<p class="mt-2 font-mono text-xs text-surface-muted-fg">{brand.theme.fontBody}</p>
				<p class="mt-6 text-lg leading-relaxed">The quick brown fox jumps over the lazy dog</p>
				<p class="mt-2 text-base leading-relaxed">{brand.homepage.heroBody}</p>
				<p class="mt-3 text-sm text-surface-muted-fg">ABCDEFGHIJKLMNOPQRSTUVWXYZ · abcdefghijklmnopqrstuvwxyz · 0123456789</p>
				<p class="mt-4 text-xs text-surface-muted-fg">Used for: body text, navigation, labels, CTAs</p>
			</div>
		</div>
	</section>

	<!-- BUTTONS -->
	<section class="mb-16">
		<h2 class="font-display text-3xl tracking-tight">Buttons & CTAs</h2>
		<div class="mt-6 flex flex-wrap items-center gap-4 rounded-sm border border-surface-border p-6">
			<button class="rounded-sm bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90">Primary CTA</button>
			<button class="rounded-sm bg-accent px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90">Accent CTA</button>
			<button class="rounded-sm border-2 border-primary px-6 py-3 text-xs font-semibold uppercase tracking-wider text-primary transition-colors hover:bg-primary hover:text-white">Outline</button>
			<button class="rounded-sm border border-surface-border px-6 py-3 text-xs font-medium text-surface-muted-fg transition-colors hover:border-surface-fg hover:text-surface-fg">Tertiary</button>
		</div>
	</section>

	<!-- BADGES -->
	<section class="mb-16">
		<h2 class="font-display text-3xl tracking-tight">Badges</h2>
		<div class="mt-6 flex flex-wrap items-center gap-3 rounded-sm border border-surface-border p-6">
			<span class="rounded-sm bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">New</span>
			<span class="rounded-sm bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">Deal</span>
			<span class="rounded-sm bg-error px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">Clearance</span>
			<span class="rounded-sm bg-warning/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider" style="color: {brand.theme.surfaceFg};">Low Stock</span>
			<span class="rounded-sm bg-surface-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-surface-muted-fg">Sample tag</span>
		</div>
	</section>

	<!-- COMPONENTS -->
	<section class="mb-16">
		<h2 class="font-display text-3xl tracking-tight">Layout Components</h2>
		<p class="mt-2 text-sm text-surface-muted-fg">
			{brand.mode === 'content'
				? `${componentList.length} components available in content mode (no transactional vocabulary)`
				: `All ${componentList.length} components in the storefront vocabulary`}
		</p>

		<div class="mt-8 space-y-12">
			{#each componentList as component}
				<div>
					<div class="mb-3 flex items-baseline justify-between border-b border-surface-border pb-2">
						<h3 class="font-mono text-sm font-semibold text-surface-fg">{component}</h3>
						<span class="text-xs text-surface-muted-fg">component</span>
					</div>
					<LayoutRenderer layout={makeSampleLayout(component)} products={sampleProducts} />
				</div>
			{/each}
		</div>
	</section>

	<!-- VOICE -->
	<section class="mb-16">
		<h2 class="font-display text-3xl tracking-tight">Voice & Persona</h2>
		<p class="mt-2 text-sm text-surface-muted-fg">Drives the AI's word choice, tone, and persona-specific layout decisions.</p>

		<div class="mt-6 rounded-sm border-l-4 border-primary bg-surface-muted p-6">
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">Voice guidance</p>
			<p class="mt-3 leading-relaxed">{brand.prompt.voiceGuidance}</p>
		</div>

		<h3 class="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">Personas (4)</h3>
		<div class="mt-3 grid gap-4 sm:grid-cols-2">
			{#each Object.entries(brand.prompt.personaDefinitions) as [name, definition]}
				<div class="rounded-sm border border-surface-border p-5">
					<p class="font-display text-lg font-semibold capitalize text-primary">{name}</p>
					<p class="mt-2 text-sm leading-relaxed text-surface-muted-fg">{definition}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- INCENTIVES -->
	{#if brand.incentives?.loyalty}
		<section class="mb-16">
			<h2 class="font-display text-3xl tracking-tight">Loyalty & Incentives</h2>
			<div class="mt-6 grid gap-6 sm:grid-cols-2">
				<div class="rounded-sm border border-surface-border p-6">
					<p class="text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">{brand.incentives.loyalty.programName}</p>
					<p class="mt-2 font-display text-2xl">Earn {brand.incentives.loyalty.unit}</p>
					{#if brand.incentives.loyalty.tiers}
						<div class="mt-4 space-y-2">
							{#each brand.incentives.loyalty.tiers as tier}
								<div class="flex items-center justify-between text-sm">
									<span class="font-medium">{tier.name}</span>
									<span class="font-mono text-xs text-surface-muted-fg">{tier.unitsRequired.toLocaleString()} {brand.incentives.loyalty.unit}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				{#if brand.incentives.freeShippingThresholdMinor != null}
					<div class="rounded-sm border border-surface-border p-6">
						<p class="text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">Free shipping</p>
						<p class="mt-2 font-display text-2xl">
							{brand.incentives.freeShippingThresholdMinor === 0
								? 'Always free'
								: `Over $${(brand.incentives.freeShippingThresholdMinor / 100).toLocaleString()}`}
						</p>
						<p class="mt-2 text-sm text-surface-muted-fg">Cart-level threshold drives the persistent shipping promo.</p>
					</div>
				{/if}
			</div>
		</section>
	{/if}

	<!-- CATEGORIES -->
	<section class="mb-16">
		<h2 class="font-display text-3xl tracking-tight">Category Map</h2>
		<p class="mt-2 text-sm text-surface-muted-fg">{brand.categories.length} categories defined.</p>
		<div class="mt-4 flex flex-wrap gap-2">
			{#each brand.categories as cat}
				<span class="rounded-sm border border-surface-border bg-surface-card px-3 py-1.5 text-xs font-medium">
					{cat.displayName}
					<span class="ml-2 font-mono text-[10px] text-surface-muted-fg">/{cat.slug}</span>
				</span>
			{/each}
		</div>
	</section>
</div>

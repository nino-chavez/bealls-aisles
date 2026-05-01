<script lang="ts">
	/**
	 * Branded 404 / error route (PRD-FND-012).
	 *
	 * Layer: foundation. Wraps the brand chrome from `+layout.svelte` (nav,
	 * brand strip, footer) and renders an AI-composed rescue band beneath
	 * a status-aware headline. Engine routes through `surface='empty'`
	 * with `reason='not-found'` (per ADR-006 + PRD-FND-012).
	 */
	import { page } from '$app/stores';
	import EmptyRescue from '$lib/components/EmptyRescue.svelte';
	import type { LayoutData } from './$types';
	import { getBrand } from '$lib/brand/config';

	let { data }: { data: LayoutData } = $props();

	let status = $derived($page.status);
	let isNotFound = $derived(status === 404);
	let headline = $derived(isNotFound ? 'We can’t find that page' : 'Something went wrong');
	let subhead = $derived(
		isNotFound
			? 'The link may be broken or the page may have moved. Here are a few places to pick up where you left off.'
			: 'Our team has been notified. While you wait, here are some ways to keep browsing.',
	);

	// Categories list comes from brand config — drives the static fallback
	// in EmptyRescue when the engine is slow or unavailable.
	const brandCategories = Object.entries(getBrand().categories).map(([slug, c]) => ({
		slug,
		name: c.displayName,
	}));
</script>

<svelte:head>
	<title>{headline} — {data.brand?.name ?? ''}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="border-b border-surface-border bg-surface-muted">
	<div class="mx-auto max-w-7xl px-6 py-16 sm:py-20">
		<p class="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
			{isNotFound ? '404' : `Error ${status ?? ''}`}
		</p>
		<h1 class="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
			{headline}
		</h1>
		<p class="mt-4 max-w-xl text-base leading-relaxed text-surface-muted-fg">
			{subhead}
		</p>
	</div>
</section>

<div class="mx-auto max-w-7xl px-6 py-16 lg:py-20">
	<EmptyRescue
		reason="not-found"
		persona={data.personaHint ?? 'gatherer'}
		categories={brandCategories}
	/>
</div>

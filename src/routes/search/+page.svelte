<script lang="ts">
	import type { PageData } from './$types';
	import HunterLayout from '$lib/components/layouts/HunterLayout.svelte';
	import GathererLayout from '$lib/components/layouts/GathererLayout.svelte';
	import EmptyRescue from '$lib/components/EmptyRescue.svelte';
	import { getBrand } from '$lib/brand/config';
	import ZoneExecutionEvidence from '$lib/foundation/ZoneExecutionEvidence.svelte';

	let { data }: { data: PageData } = $props();
	const brandCategories = Object.entries(getBrand().categories).map(([slug, c]) => ({
		slug,
		name: c.displayName,
	}));
</script>

<svelte:head>
	<title>Search: {data.query}</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-6 py-8">
	<!-- Dev mode: persona shift detection -->
	{#if data.devMode && data.personaShift}
		<div class="mb-6 rounded-sm border border-warning/30 bg-warning/5 p-4">
			<p class="text-xs font-medium uppercase tracking-wider text-warning">Persona Shift Detected</p>
			<p class="mt-1 text-sm text-surface-muted-fg">
				Stored persona: <span class="font-semibold">{data.storedPersona}</span> →
				New signals: <span class="font-semibold text-surface-fg">{data.persona}</span>
				({Math.round(data.confidence * 100)}% confidence)
			</p>
			<p class="mt-1 text-xs text-surface-muted-fg">
				Query "{data.query}" conflicts with stored model. System adapted to current intent.
			</p>
		</div>
	{/if}

	{#if data.results.length === 0}
		<div data-empty-state="empty-search">
		<!-- PRD-FND-012: zero-result rescue. Foundation owns the headline copy
			 (so the shopper instantly understands what happened); engine
			 composes the rescue band beneath. -->
		<div class="border-b border-surface-border pb-10">
			<h1 class="font-display text-3xl">No results for “{data.query}”</h1>
			<p class="mt-2 text-surface-muted-fg">
				We searched the catalog and didn’t find a match. Here’s what shoppers like you are exploring instead.
			</p>
		</div>

		<div class="mt-10">
			<EmptyRescue
				reason="empty-search"
				persona={data.persona ?? 'gatherer'}
				categories={brandCategories}
			/>
		</div>
		</div>
	{:else if data.suggestedCategory}
		<!-- Route to category page with persona-appropriate layout -->
		<div class="mb-6">
			<p class="text-sm text-surface-muted-fg">
				{data.resultCount} results for "<span class="text-surface-fg">{data.query}</span>"
				{#if data.devMode}
					— persona: {data.persona} ({Math.round(data.confidence * 100)}%)
				{/if}
			</p>
		</div>

		{#if data.persona === 'hunter'}
			<HunterLayout
				category={{ name: `Results for "${data.query}"`, slug: 'search' }}
				products={data.results}
			/>
		{:else}
			<GathererLayout
				category={{ name: `Results for "${data.query}"`, slug: 'search' }}
				products={data.results}
			/>
		{/if}
	{:else}
		<h1 class="text-2xl">{data.resultCount} results for "{data.query}"</h1>
		<div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
			{#each data.results as product}
				<a href="/product/{product.id}" class="group">
					<div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-muted">
						{#if product.image}
							<img src={product.image} alt={product.imageAlt} class="h-full w-full object-cover" loading="lazy" />
						{/if}
					</div>
					<div class="mt-3">
						<h3 class="text-sm font-medium group-hover:text-primary">{product.name}</h3>
						<span class="mt-1 text-sm font-medium">${product.price}</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>

<ZoneExecutionEvidence executions={data.emptyZoneExecution ? [data.zoneExecution, data.emptyZoneExecution] : [data.zoneExecution]} />

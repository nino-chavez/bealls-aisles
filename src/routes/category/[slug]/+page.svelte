<script lang="ts">
	import type { PageData } from './$types';
	import type { Layout } from '$lib/schema/layout';
	import LayoutRenderer from '$lib/components/layouts/LayoutRenderer.svelte';
	import LayoutSkeleton from '$lib/components/layouts/LayoutSkeleton.svelte';
	import GathererLayout from '$lib/components/layouts/GathererLayout.svelte';
	import HunterLayout from '$lib/components/layouts/HunterLayout.svelte';
	import RefinementChat from '$lib/components/RefinementChat.svelte';

	let { data }: { data: PageData } = $props();

	let aiLayout = $state<Layout | null>(null);
	let aiMeta = $state<{ generationTimeMs: number; persona: string } | null>(null);
	let aiError = $state<string | null>(null);
	let isLoading = $state(true);
	let overridePersona = $state<string | null>(null);
	let currentPersona = $derived(overridePersona ?? data.persona);

	// Fetch AI-generated layout on mount / persona change
	$effect(() => {
		const persona = currentPersona;
		fetchLayout(persona);
	});

	async function fetchLayout(persona: string) {
		isLoading = true;
		aiError = null;
		aiLayout = null;

		const productSummaries = data.products.map((p) => ({
			id: p.id,
			name: p.name,
			price: p.price,
			salePrice: p.salePrice,
			specs: p.specs,
		}));

		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 15000);

			const res = await fetch('/api/layout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					persona,
					categoryName: data.category.name,
					products: productSummaries,
				}),
				signal: controller.signal,
			});

			clearTimeout(timeout);

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.message || 'Layout generation failed');
			}

			const result = await res.json();
			aiLayout = result.layout;
			aiMeta = result.meta;
		} catch (err) {
			aiError = err instanceof Error ? err.message : 'Unknown error';
			console.error('AI layout failed, falling back:', aiError);
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>{data.category.name} — Haven</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-6 py-8">
	<!-- Dev mode panel -->
	{#if data.devMode}
		<div class="mb-6 rounded-sm border border-accent/30 bg-accent/5 p-4">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-xs font-medium uppercase tracking-wider text-accent">Dev Mode — AI Layout</p>
					<p class="mt-1 text-sm text-surface-muted-fg">
						Persona: <span class="font-semibold text-surface-fg">{currentPersona}</span>
						({Math.round(data.confidence * 100)}% confidence)
						&middot; Source: <span class="font-medium">{data.sessionContext?.personaSource}</span>
						{#if data.sessionContext?.personaShift}
							&middot; <span class="font-semibold text-warning">PERSONA SHIFT DETECTED</span>
						{/if}
						{#if aiMeta}
							&middot; Generated in {aiMeta.generationTimeMs}ms
						{/if}
						{#if aiError}
							&middot; <span class="text-error">Fallback: {aiError}</span>
						{/if}
					</p>
					{#if data.sessionContext}
						<p class="mt-1 text-xs text-surface-muted-fg">
							Visit #{data.sessionContext.visitCount}
							{#if data.sessionContext.storedPersona}
								&middot; Previous: {data.sessionContext.storedPersona} on {data.sessionContext.storedCategory}
							{/if}
							{#if data.sessionContext.searchQuery}
								&middot; Query: "{data.sessionContext.searchQuery}"
							{/if}
						</p>
					{/if}
				</div>
				<div class="flex gap-2">
					{#each ['gatherer', 'hunter'] as persona}
						<button
							onclick={() => overridePersona = persona}
							class="rounded-sm px-3 py-1.5 text-xs font-medium transition-colors
								{currentPersona === persona
									? 'bg-accent text-white'
									: 'border border-surface-border text-surface-muted-fg hover:text-surface-fg'}"
						>
							{persona.charAt(0).toUpperCase() + persona.slice(1)}
						</button>
					{/each}
				</div>
			</div>

			<!-- Show AI reasoning and raw schema -->
			{#if aiLayout}
				<details class="mt-3">
					<summary class="cursor-pointer text-xs text-accent hover:underline">View AI reasoning & schema</summary>
					<div class="mt-2 rounded-sm bg-surface-card p-3">
						<p class="text-sm text-surface-muted-fg"><strong>Reasoning:</strong> {aiLayout.reasoning}</p>
						<pre class="mt-2 max-h-64 overflow-auto rounded-sm bg-neutral-950 p-3 text-xs text-neutral-300">{JSON.stringify(aiLayout, null, 2)}</pre>
					</div>
				</details>
			{/if}
		</div>
	{/if}

	<!-- Content area -->
	{#if isLoading}
		<LayoutSkeleton />
	{:else if aiLayout}
		<LayoutRenderer layout={aiLayout} products={data.products} />
	{:else if currentPersona === 'gatherer'}
		<GathererLayout category={data.category} products={data.products} />
	{:else}
		<HunterLayout category={data.category} products={data.products} />
	{/if}
</div>

<!-- Refinement chat — floats over the page -->
{#if !isLoading}
	<RefinementChat
		persona={currentPersona}
		categoryName={data.category.name}
		products={data.products}
		currentLayout={aiLayout}
		onLayoutUpdate={(newLayout) => { aiLayout = newLayout; }}
	/>
{/if}

<script lang="ts">
	import type { PageData } from './$types';
	import type { Layout } from '$lib/schema/layout';
	import type { PersonaInference } from '$lib/signals/types';
	import { PERSONAS } from '$lib/signals/types';
	import LayoutRenderer from '$lib/components/layouts/LayoutRenderer.svelte';
	import LayoutSkeleton from '$lib/components/layouts/LayoutSkeleton.svelte';
	import GathererLayout from '$lib/components/layouts/GathererLayout.svelte';
	import HunterLayout from '$lib/components/layouts/HunterLayout.svelte';
	import ResearcherLayout from '$lib/components/layouts/ResearcherLayout.svelte';
	import GifterLayout from '$lib/components/layouts/GifterLayout.svelte';
	import RefinementChat from '$lib/components/RefinementChat.svelte';

	let { data }: { data: PageData } = $props();

	let aiLayout = $state<Layout | null>(null);
	let aiMeta = $state<{ generationTimeMs: number; persona: string; cacheHit?: boolean } | null>(null);
	let aiError = $state<string | null>(null);
	let isLoading = $state(true);
	let overridePersona = $state<string | null>(null);
	let currentPersona = $derived(overridePersona ?? data.persona);

	// Fetch AI-generated layout on mount / persona change
	$effect(() => {
		const persona = currentPersona;
		fetchLayout(persona);
	});

	// Listen for inference updates from the signal pipeline
	$effect(() => {
		const handleInferenceUpdate = (e: Event) => {
			const inference = (e as CustomEvent).detail;
			if (inference?.primary && inference.primary !== currentPersona) {
				overridePersona = inference.primary;
			}
		};

		window.addEventListener('aisles-inference-update', handleInferenceUpdate);
		return () => window.removeEventListener('aisles-inference-update', handleInferenceUpdate);
	});

	async function fetchLayout(persona: string) {
		isLoading = true;
		aiError = null;
		aiLayout = null;

		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 15000);

			const res = await fetch('/api/layout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					persona,
					categorySlug: data.category.slug,
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

	/** Format a probability as a percentage string */
	function pct(n: number): string {
		return `${Math.round(n * 100)}%`;
	}
</script>

<svelte:head>
	<title>{data.category.name} — Haven</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-6 py-8">
	<!-- Dev mode panel -->
	{#if data.devMode}
		{@const inf = data.inference}
		<div class="mb-6 rounded-sm border border-accent/30 bg-accent/5 p-4">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-xs font-medium uppercase tracking-wider text-accent">Dev Mode — Inference Engine</p>
					<p class="mt-1 text-sm text-surface-muted-fg">
						Primary: <span class="font-semibold text-surface-fg">{currentPersona}</span>
						({pct(inf.probabilities[inf.primary])} prob, {pct(inf.confidence)} confidence gap)
						&middot; Source: <span class="font-medium">{inf.dominantSource}</span>
						&middot; Signals: {inf.signalCount}
						{#if inf.shift.detected}
							&middot; <span class="font-semibold text-warning">SHIFT: {inf.shift.from} &rarr; {inf.primary}</span>
						{/if}
						{#if aiMeta}
							&middot; Layout in {aiMeta.generationTimeMs}ms
							{#if aiMeta.cacheHit}
								&middot; <span class="font-medium text-accent">CACHE HIT</span>
							{/if}
						{/if}
						{#if aiError}
							&middot; <span class="text-error">Fallback: {aiError}</span>
						{/if}
					</p>

					<!-- Probability vector bar -->
					<div class="mt-2 flex items-center gap-3 text-xs">
						{#each PERSONAS as p}
							<div class="flex items-center gap-1.5">
								<span class="font-medium {p === inf.primary ? 'text-surface-fg' : 'text-surface-muted-fg'}">{p}</span>
								<div class="h-1.5 w-16 rounded-full bg-surface-muted">
									<div
										class="h-full rounded-full {p === inf.primary ? 'bg-accent' : 'bg-surface-muted-fg/40'}"
										style="width: {inf.probabilities[p] * 100}%"
									></div>
								</div>
								<span class="tabular-nums text-surface-muted-fg">{pct(inf.probabilities[p])}</span>
							</div>
						{/each}
					</div>

					<!-- Modifiers -->
					<div class="mt-1.5 flex gap-3 text-xs text-surface-muted-fg">
						<span>price sensitivity: {pct(inf.modifiers.priceSensitivity)}</span>
						<span>urgency: {pct(inf.modifiers.urgency)}</span>
						<span>familiarity: {pct(inf.modifiers.familiarityWithStore)}</span>
					</div>

					{#if data.sessionContext}
						<p class="mt-1.5 text-xs text-surface-muted-fg">
							Visit #{data.sessionContext.visitCount}
							{#if data.sessionContext.storedPersona}
								&middot; Previous: {data.sessionContext.storedPersona} on {data.sessionContext.storedCategory}
							{/if}
							{#if data.sessionContext.searchQuery}
								&middot; Query: "{data.sessionContext.searchQuery}"
							{/if}
							{#if inf.shift.trigger}
								&middot; Shift trigger: {inf.shift.trigger}
							{/if}
						</p>
					{/if}
				</div>

				<!-- Persona toggle — all 4 personas -->
				<div class="flex flex-col gap-1.5">
					{#each PERSONAS as persona}
						<button
							onclick={() => overridePersona = persona}
							class="rounded-sm px-3 py-1 text-xs font-medium transition-colors
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

			<!-- Raw inference JSON -->
			<details class="mt-2">
				<summary class="cursor-pointer text-xs text-accent hover:underline">View raw inference</summary>
				<pre class="mt-2 max-h-48 overflow-auto rounded-sm bg-neutral-950 p-3 text-xs text-neutral-300">{JSON.stringify(inf, null, 2)}</pre>
			</details>
		</div>
	{/if}

	<!-- Content area -->
	{#if isLoading}
		<LayoutSkeleton />
	{:else if aiLayout}
		<LayoutRenderer layout={aiLayout} products={data.products} />
	{:else if currentPersona === 'gatherer'}
		<GathererLayout category={data.category} products={data.products} />
	{:else if currentPersona === 'hunter'}
		<HunterLayout category={data.category} products={data.products} />
	{:else if currentPersona === 'researcher'}
		<ResearcherLayout category={data.category} products={data.products} />
	{:else if currentPersona === 'gifter'}
		<GifterLayout category={data.category} products={data.products} />
	{:else}
		<GathererLayout category={data.category} products={data.products} />
	{/if}
</div>

<!-- Refinement chat — floats over the page -->
{#if !isLoading}
	<RefinementChat
		persona={currentPersona}
		categorySlug={data.category.slug}
		currentLayout={aiLayout}
		onLayoutUpdate={(newLayout) => { aiLayout = newLayout; }}
	/>
{/if}

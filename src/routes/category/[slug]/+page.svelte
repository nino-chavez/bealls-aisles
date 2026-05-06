<script lang="ts">
	import type { PageData } from './$types';
	import type { Layout } from '$lib/schema/layout';
	import type { PersonaInference } from '$lib/signals/types';
	import LayoutRenderer from '$lib/components/layouts/LayoutRenderer.svelte';
	import FilterStrip from '$lib/components/primitives/FilterStrip.svelte';
	import SortSelector from '$lib/components/primitives/SortSelector.svelte';
	import LayoutBuildingState from '$lib/components/LayoutBuildingState.svelte';
	import GathererLayout from '$lib/components/layouts/GathererLayout.svelte';
	import HunterLayout from '$lib/components/layouts/HunterLayout.svelte';
	import ResearcherLayout from '$lib/components/layouts/ResearcherLayout.svelte';
	import GifterLayout from '$lib/components/layouts/GifterLayout.svelte';
	import ContentCategorySurface from '$lib/components/layouts/ContentCategorySurface.svelte';
	import RefinementChat from '$lib/components/RefinementChat.svelte';
	import { picksContextForPrompt } from '$lib/stores/picks.svelte';
	import { getEmitter } from '$lib/signals/emitter';
	import { setDevInference, clearDevInference, PERSONA_OVERRIDE_EVENT, type PersonaOverrideDetail } from '$lib/stores/dev-inference.svelte';

	let { data }: { data: PageData } = $props();
	const isContentMode = $derived(data.contentMode === true);

	let aiLayout = $state<Layout | null>(null);
	let aiMeta = $state<{ generationTimeMs: number; persona: string; cacheHit?: boolean } | null>(null);
	let aiError = $state<string | null>(null);
	let isUpgrading = $state(true);
	let overridePersona = $state<string | null>(null);
	// Tracks whether the override was set explicitly by the user (via dev panel
	// button) vs. by the inference pipeline. When true, the inference-update
	// listener stops overwriting it — so a manual choice sticks until either
	// the user clears it or navigates to another category.
	let manualOverride = $state(false);
	let sessionCost = $state<{ totalCost: number; generations: number; tokens: number; cacheHitRate: number } | null>(null);
	let currentPersona = $derived(overridePersona ?? data.persona ?? 'gatherer');
	// ADR-008 Phase A: tag intents extracted by the refinement chat. When
	// the shopper says "warm and cozy", the chat surfaces those tags here
	// and subsequent /api/layout calls pass them through for filtering/rerank.
	// Resets when the category changes (intent is contextual to the surface).
	let tagIntents = $state<string[]>([]);

	// Persona-default sort. Hunter is restocking -> price-low; gatherer
	// is exploring -> newest; researcher wants reviews -> bestsellers.
	const SORT_OPTIONS = [
		{ value: 'newest', label: 'Newest' },
		{ value: 'price-low', label: 'Price: low to high' },
		{ value: 'price-high', label: 'Price: high to low' },
		{ value: 'bestsellers', label: 'Best sellers' },
		{ value: 'rating', label: 'Top rated' },
	];
	function defaultSortFor(persona: string): string {
		if (persona === 'hunter') return 'price-low';
		if (persona === 'researcher') return 'bestsellers';
		return 'newest';
	}
	let sortValue = $state(defaultSortFor(currentPersona));
	$effect(() => {
		// Keep sort aligned with persona until the user manually changes it.
		sortValue = defaultSortFor(currentPersona);
	});

	// Fetch AI-generated layout on mount / persona change
	// Track category to reset layout on navigation
	let lastCategory = $state(data.category.slug);

	$effect(() => {
		if (isContentMode) return;
		const persona = currentPersona;
		const slug = data.category.slug;

		// Clear stale layout when category changes
		if (slug !== lastCategory) {
			aiLayout = null;
			aiMeta = null;
			tagIntents = [];
			lastCategory = slug;
			// Clear manual override when navigating — intent is contextual to surface.
			manualOverride = false;
			overridePersona = null;
		}

		fetchLayout(persona);
	});

	// Listen for inference updates from the signal pipeline. Skip the update
	// when the user has explicitly chosen a persona via the dev panel — their
	// manual choice should stick until they reset it or navigate.
	$effect(() => {
		const handleInferenceUpdate = (e: Event) => {
			if (manualOverride) return;
			const inference = (e as CustomEvent).detail;
			if (inference?.primary && inference.primary !== currentPersona) {
				overridePersona = inference.primary;
			}
		};

		window.addEventListener('aisles-inference-update', handleInferenceUpdate);
		return () => window.removeEventListener('aisles-inference-update', handleInferenceUpdate);
	});

	// Listen for persona-override events from the global InferenceEnginePanel.
	$effect(() => {
		const handleOverride = (e: Event) => {
			const detail = (e as CustomEvent<PersonaOverrideDetail>).detail;
			if (detail.persona === null) {
				manualOverride = false;
				overridePersona = null;
			} else {
				overridePersona = detail.persona;
				manualOverride = true;
			}
		};
		window.addEventListener(PERSONA_OVERRIDE_EVENT, handleOverride);
		return () => window.removeEventListener(PERSONA_OVERRIDE_EVENT, handleOverride);
	});

	// Populate the dev-inference store so the global InferenceEnginePanel
	// can render with this page's inference state. Cleared on unmount.
	$effect(() => {
		if (isContentMode || !data.devMode || !data.inference) return;
		setDevInference({
			surface: `PLP — ${data.category?.name ?? data.category?.slug ?? '?'}`,
			inference: data.inference,
			aiMeta,
			aiError,
			sessionContext: data.sessionContext ?? null,
			sessionCost,
			currentPersona,
			manualOverride,
		});
		return () => clearDevInference();
	});

	async function fetchLayout(persona: string) {
		isUpgrading = true;
		aiError = null;

		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 30000);

			const res = await fetch('/api/layout/stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					persona,
					categorySlug: data.category.slug,
					picksContext: picksContextForPrompt(),
					probabilities: data.inference?.probabilities,
					tagIntents,
				}),
				signal: controller.signal,
			});

			clearTimeout(timeout);

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.message || 'Layout generation failed');
			}

			const contentType = res.headers.get('content-type') || '';

			if (contentType.includes('application/json')) {
				// Cache hit — complete JSON response
				const result = await res.json();
				aiLayout = result.layout;
				aiMeta = result.meta;
			} else {
				// Cache miss — SSE stream of partial objects
				const reader = res.body?.getReader();
				if (!reader) throw new Error('No response body');

				const decoder = new TextDecoder();
				let buffer = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });

					// Parse SSE events from buffer
					const lines = buffer.split('\n\n');
					buffer = lines.pop() || ''; // Keep incomplete chunk

					for (const chunk of lines) {
						const line = chunk.trim();
						if (!line.startsWith('data: ')) continue;

						const payload = JSON.parse(line.slice(6));

						if (payload.__done) {
							// Final validated layout
							aiLayout = payload.layout;
							aiMeta = payload.meta;
						} else if (payload.__error) {
							throw new Error(payload.message);
						} else if (payload.sections?.length) {
							// Partial layout — render sections as they arrive
							aiLayout = payload as Layout;
						}
					}
				}
			}
		} catch (err) {
			aiError = err instanceof Error ? err.message : 'Unknown error';
			console.error('AI layout generation failed, using static layout:', aiError);
		} finally {
			isUpgrading = false;
		}
	}

	// Fetch session cost data in dev mode
	$effect(() => {
		if (isContentMode || !data.devMode) return;

		async function fetchCost() {
			try {
				const sessionId = data.sessionId;
				if (!sessionId) return;
				const res = await fetch(`/api/observe/logs?session=${sessionId}&limit=50&key=aisles-observe`);
				const { logs } = await res.json();
				if (!logs?.length) return;
				const totalCost = logs.reduce((s: number, l: any) => s + (l.estimatedCost ?? 0), 0);
				const tokens = logs.reduce((s: number, l: any) => s + (l.inputTokens ?? 0) + (l.outputTokens ?? 0), 0);
				const cacheHits = logs.filter((l: any) => l.cacheHit).length;
				sessionCost = {
					totalCost,
					generations: logs.length,
					tokens,
					cacheHitRate: Math.round((cacheHits / logs.length) * 100),
				};
			} catch { /* non-critical */ }
		}

		fetchCost();
	});

	// Track scroll depth on category pages
	$effect(() => {
		let maxDepth = 0;
		let emitted25 = false;
		let emitted50 = false;
		let emitted75 = false;

		const handleScroll = () => {
			const scrollTop = window.scrollY;
			const docHeight = document.documentElement.scrollHeight - window.innerHeight;
			if (docHeight <= 0) return;
			const depth = Math.round((scrollTop / docHeight) * 100);
			if (depth <= maxDepth) return;
			maxDepth = depth;

			const emitter = getEmitter();
			if (!emitter) return;

			if (depth >= 75 && !emitted75) {
				emitted75 = true;
				emitter.emit('interact.scroll_depth', { depth: 75, category: data.category.slug });
			} else if (depth >= 50 && !emitted50) {
				emitted50 = true;
				emitter.emit('interact.scroll_depth', { depth: 50, category: data.category.slug });
			} else if (depth >= 25 && !emitted25) {
				emitted25 = true;
				emitter.emit('interact.scroll_depth', { depth: 25, category: data.category.slug });
			}
		};

		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => window.removeEventListener('scroll', handleScroll);
	});

</script>

<svelte:head>
	<title>{data.category.name}{isContentMode ? '' : ` — ${data.persona} view`}</title>
	<meta name="description" content={isContentMode ? `${data.category.name} at your nearest store.` : `Browse ${data.category.name} — personalized for ${data.persona} shoppers. ${data.products?.length ?? 0} products available.`} />
</svelte:head>

{#if isContentMode}
	<ContentCategorySurface
		category={data.category}
		brandPillars={data.brandPillars ?? []}
		heroImage={data.heroImage ?? ''}
		heroBody={data.heroBody ?? ''}
		heroEyebrow={data.heroEyebrow ?? ''}
		locatorCta={data.locatorCta ?? 'Find a Store'}
		locatorBody={data.locatorBody ?? ''}
	/>
{:else}
<div class="mx-auto max-w-7xl px-6 py-8">
	<!-- Inference Engine panel is now mounted globally from +layout.svelte
	     and reads from the dev-inference store populated above. -->
	{#if data.devMode && aiLayout}
		<details class="mb-4">
			<summary class="cursor-pointer text-xs text-accent hover:underline">View AI reasoning & schema</summary>
			<div class="mt-2 rounded-sm bg-surface-card p-3">
				<p class="text-sm text-surface-muted-fg"><strong>Reasoning:</strong> {aiLayout.reasoning}</p>
				<pre class="mt-2 max-h-64 overflow-auto rounded-sm bg-neutral-950 p-3 text-xs text-neutral-300">{JSON.stringify(aiLayout, null, 2)}</pre>
			</div>
		</details>
	{/if}

	<!-- Filter + sort foundation strip — deterministic UI above the AI grid.
	     Filter chips render when active filters are present (none by default in the demo);
	     sort selector defaults per persona and stays sticky. -->
	{#if !isContentMode}
		<div class="flex items-end justify-between gap-4 pt-4">
			<FilterStrip resultCount={data.products?.length ?? 0} />
			<SortSelector options={SORT_OPTIONS} bind:value={sortValue} />
		</div>
	{/if}

	<!-- Content area: show static fallback instantly, upgrade to AI layout when ready -->
	{#if aiLayout}
		<LayoutRenderer layout={aiLayout} products={data.products ?? []} />
	{:else if isUpgrading}
		<div class="-mx-6">
			<LayoutBuildingState persona={currentPersona} surface="category" categoryName={data.category.name} />
		</div>
		<!-- Subtle skeleton beneath the banner -->
		<div class="mt-12 animate-pulse">
			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each Array(6) as _}
					<div>
						<div class="aspect-[4/3] rounded bg-surface-muted"></div>
						<div class="mt-3 h-4 w-3/4 rounded bg-surface-muted"></div>
						<div class="mt-2 h-4 w-1/3 rounded bg-surface-muted"></div>
					</div>
				{/each}
			</div>
		</div>
	{:else if currentPersona === 'gatherer'}
		<GathererLayout category={data.category} products={data.products ?? []} />
	{:else if currentPersona === 'hunter'}
		<HunterLayout category={data.category} products={data.products ?? []} />
	{:else if currentPersona === 'researcher'}
		<ResearcherLayout category={data.category} products={data.products ?? []} />
	{:else if currentPersona === 'gifter'}
		<GifterLayout category={data.category} products={data.products ?? []} />
	{:else}
		<GathererLayout category={data.category} products={data.products ?? []} />
	{/if}

	<!-- Personalizing indicator — subtle pill at bottom-left -->
	{#if isUpgrading}
		<div class="fixed bottom-20 left-6 z-30 flex items-center gap-2 rounded-full bg-surface-card px-4 py-2 text-xs text-surface-muted-fg shadow-md border border-surface-border">
			<span class="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse"></span>
			Personalizing...
		</div>
	{/if}
</div>

<!-- Refinement chat — floats over the page -->
{#if !isUpgrading && !isContentMode}
	<RefinementChat
		persona={currentPersona}
		categorySlug={data.category.slug}
		currentLayout={aiLayout}
		onLayoutUpdate={(newLayout) => { aiLayout = newLayout; }}
		onTagIntentsUpdate={(next) => { tagIntents = next; }}
	/>
{/if}
{/if}

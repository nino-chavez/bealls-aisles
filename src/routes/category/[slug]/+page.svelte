<script lang="ts">
	import type { PageData } from './$types';
	import type { PersonaInference } from '$lib/signals/types';
	import { PERSONAS } from '$lib/signals/types';
	import FilterStrip from '$lib/components/primitives/FilterStrip.svelte';
	import SortSelector from '$lib/components/primitives/SortSelector.svelte';
	import GathererLayout from '$lib/components/layouts/GathererLayout.svelte';
	import HunterLayout from '$lib/components/layouts/HunterLayout.svelte';
	import ResearcherLayout from '$lib/components/layouts/ResearcherLayout.svelte';
	import GifterLayout from '$lib/components/layouts/GifterLayout.svelte';
	import ContentCategorySurface from '$lib/components/layouts/ContentCategorySurface.svelte';
	import { getEmitter } from '$lib/signals/emitter';
	import RuntimeZone from '$lib/foundation/RuntimeZone.svelte';
	import ZoneExecutionEvidence from '$lib/foundation/ZoneExecutionEvidence.svelte';

	let { data }: { data: PageData } = $props();
	const isContentMode = $derived(data.contentMode === true);

	let overridePersona = $state<string | null>(null);
	// Tracks whether the override was set explicitly by the user (via dev panel
	// button) vs. by the inference pipeline. When true, the inference-update
	// listener stops overwriting it — so a manual choice sticks until either
	// the user clears it or navigates to another category.
	let manualOverride = $state(false);
	let sessionCost = $state<{ totalCost: number; generations: number; tokens: number; cacheHitRate: number } | null>(null);
	let currentPersona = $derived(overridePersona ?? data.persona ?? 'gatherer');

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

	// Whole-layout upgrades are disabled until a named PLP zone is granted
	// model authority. The current policy marks every PLP zone fixed.

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

	/** Format a probability as a percentage string */
	function pct(n: number): string {
		return `${Math.round(n * 100)}%`;
	}
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
	<!-- Dev mode panel -->
	{#if data.devMode && data.inference}
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

					<!-- Session API Cost -->
					{#if sessionCost}
						<div class="mt-1.5 flex gap-3 text-xs">
							<span class="text-surface-muted-fg">Session cost: <span class="font-mono font-medium text-surface-fg">${sessionCost.totalCost.toFixed(4)}</span></span>
							<span class="text-surface-muted-fg">{sessionCost.generations} generations</span>
							<span class="text-surface-muted-fg">{sessionCost.tokens.toLocaleString()} tokens</span>
							<span class="text-surface-muted-fg">cache: {sessionCost.cacheHitRate}%</span>
						</div>
					{/if}

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

				<!-- Persona toggle — all 4 personas + reset -->
				<div class="flex flex-col gap-1.5">
					{#each PERSONAS as persona}
						<button
							onclick={() => { overridePersona = persona; manualOverride = true; }}
							class="rounded-sm px-3 py-1 text-xs font-medium transition-colors
								{currentPersona === persona
									? 'bg-accent text-white'
									: 'border border-surface-border text-surface-muted-fg hover:text-surface-fg'}"
						>
							{persona.charAt(0).toUpperCase() + persona.slice(1)}
						</button>
					{/each}
					{#if manualOverride}
						<button
							onclick={() => { manualOverride = false; overridePersona = null; }}
							class="mt-1 rounded-sm px-3 py-1 text-[10px] font-medium text-surface-muted-fg hover:text-surface-fg"
							title="Resume inference-driven persona"
						>
							↻ Reset to inferred
						</button>
					{/if}
				</div>
			</div>

			<!-- Signal breakdown — which rules fired and why -->
			{#if inf.ruleMatches?.length > 0}
				<details class="mt-2" open>
					<summary class="cursor-pointer text-xs text-accent hover:underline">Signal breakdown ({inf.ruleMatches.length} rules fired)</summary>
					<div class="mt-2 overflow-x-auto">
						<table class="w-full text-xs">
							<thead>
								<tr class="border-b border-surface-border text-left text-surface-muted-fg">
									<th class="pb-1 pr-3">Rule</th>
									<th class="pb-1 pr-3">Reason</th>
									<th class="pb-1 pr-3">Weight</th>
									<th class="pb-1">Score Impact</th>
								</tr>
							</thead>
							<tbody>
								{#each inf.ruleMatches as match}
									<tr class="border-b border-surface-border/50">
										<td class="py-1.5 pr-3 font-mono text-surface-fg">{match.ruleName}</td>
										<td class="py-1.5 pr-3 text-surface-muted-fg">{match.reason}</td>
										<td class="py-1.5 pr-3 tabular-nums text-surface-muted-fg">{match.weight.toFixed(1)}</td>
										<td class="py-1.5">
											{#each ['gatherer', 'hunter', 'researcher', 'gifter'] as p}
												{#if (match.adjustment as any)[p]}
													<span class="mr-1.5 rounded-sm px-1 py-0.5 text-[10px] font-medium
														{p === inf.primary ? 'bg-accent/15 text-accent' : 'bg-surface-muted text-surface-muted-fg'}">
														{p}: +{((match.adjustment as any)[p] * match.weight).toFixed(2)}
													</span>
												{/if}
											{/each}
											{#if match.adjustment.priceSensitivity}
												<span class="mr-1.5 rounded-sm bg-warning/10 px-1 py-0.5 text-[10px] text-warning">price +{(match.adjustment.priceSensitivity * match.weight).toFixed(2)}</span>
											{/if}
											{#if match.adjustment.urgency}
												<span class="mr-1.5 rounded-sm bg-error/10 px-1 py-0.5 text-[10px] text-error">urgency +{(match.adjustment.urgency * match.weight).toFixed(2)}</span>
											{/if}
											{#if match.adjustment.familiarityWithStore}
												<span class="rounded-sm bg-info/10 px-1 py-0.5 text-[10px] text-info">familiarity +{(match.adjustment.familiarityWithStore * match.weight).toFixed(2)}</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</details>
			{:else}
				<p class="mt-2 text-xs text-surface-muted-fg">No inference rules fired — using base prior (gatherer: 0.3, hunter: 0.2, researcher: 0.2, gifter: 0.1)</p>
			{/if}

			<!-- Raw inference JSON (collapsed) -->
			<details class="mt-2">
				<summary class="cursor-pointer text-xs text-accent hover:underline">View raw inference JSON</summary>
				<pre class="mt-2 max-h-48 overflow-auto rounded-sm bg-neutral-950 p-3 text-xs text-neutral-300">{JSON.stringify(inf, null, 2)}</pre>
			</details>
		</div>
	{/if}

	<!-- Filter + sort foundation strip — deterministic UI above the AI grid.
	     Filter chips render when active filters are present (none by default in the demo);
	     sort selector defaults per persona and stays sticky. -->
	{#if !isContentMode}
		<div class="pt-4">
			<RuntimeZone execution={data.zoneExecution} zoneId="plp.banner" products={data.products ?? []} />
		</div>
		<div class="flex items-end justify-between gap-4 pt-4">
			<FilterStrip resultCount={data.products?.length ?? 0} />
			<SortSelector options={SORT_OPTIONS} bind:value={sortValue} />
		</div>
	{/if}

	<!-- Current PLP policy is rules/fixed only; the existing persona recipe remains in control. -->
	{#if currentPersona === 'gatherer'}
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

</div>

{/if}

<ZoneExecutionEvidence executions={[data.zoneExecution]} />

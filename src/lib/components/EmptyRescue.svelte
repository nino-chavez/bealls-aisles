<script lang="ts">
	/**
	 * EmptyRescue — foundation-layer rescue band for empty/404 surfaces (PRD-FND-012).
	 *
	 * Calls the engine with `surface='empty'` + a `reason` discriminator and
	 * renders the AI-composed rescue layout. While generating it shows the
	 * standard LayoutBuildingState; on engine failure it falls back to a
	 * brand-aware static rescue (categories grid + go-home CTA).
	 *
	 * The static fallback is the always-defined render path per the
	 * fail-fast principle — engine outage ≠ blank screen.
	 */
	import type { Layout } from '$lib/schema/layout';
	import type { Product } from '$lib/types';
	import LayoutRenderer from '$lib/components/layouts/LayoutRenderer.svelte';
	import LayoutBuildingState from '$lib/components/LayoutBuildingState.svelte';

	let {
		reason,
		persona = 'gatherer',
		categories = [],
	}: {
		reason: 'not-found' | 'empty-cart' | 'empty-search' | 'empty-wishlist';
		persona?: string;
		categories?: Array<{ slug: string; name: string }>;
	} = $props();

	let layout = $state<Layout | null>(null);
	let products = $state<Product[]>([]);
	let isLoading = $state(true);
	let failed = $state(false);

	$effect(() => {
		fetchRescue();
	});

	async function fetchRescue() {
		isLoading = true;
		failed = false;
		try {
			const res = await fetch('/api/layout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					persona,
					categorySlug: 'home',
					surface: 'empty',
					reason,
				}),
			});
			if (!res.ok) throw new Error(`rescue ${res.status}`);
			const json = await res.json();
			if (!json.layout) throw new Error('no layout');
			layout = json.layout;
			products = json.products ?? [];
		} catch (e) {
			failed = true;
			console.warn(`Rescue (${reason}) failed:`, e);
		} finally {
			isLoading = false;
		}
	}
</script>

{#if isLoading}
	<LayoutBuildingState {persona} surface={reason === 'empty-cart' ? 'cart' : 'rescue'} />
{:else if layout && !failed}
	<LayoutRenderer {layout} {products} />
{:else}
	<!-- Static fallback — brand-aware, always renders -->
	{#if categories.length > 0}
		<section>
			<h2 class="font-display text-2xl tracking-tight">Browse by category</h2>
			<div class="mt-6 grid gap-px overflow-hidden rounded-sm border border-surface-border bg-surface-border sm:grid-cols-2 lg:grid-cols-4">
				{#each categories.slice(0, 4) as cat}
					<a
						href="/category/{cat.slug}"
						class="group relative flex flex-col justify-end bg-surface-card p-6 transition-colors hover:bg-surface-muted"
						style="min-height: 140px;"
					>
						<h3 class="font-display text-lg">{cat.name}</h3>
						<span class="mt-1 text-sm text-primary group-hover:underline">Browse &rarr;</span>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<div class="mt-10 text-center">
		<a
			href="/"
			class="inline-flex items-center rounded-sm bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
		>
			Go to homepage
		</a>
	</div>
{/if}

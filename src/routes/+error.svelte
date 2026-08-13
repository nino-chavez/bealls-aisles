<script lang="ts">
	/**
	 * Branded 404 / error route (PRD-FND-012).
	 *
	 * Layer: foundation. Wraps brand chrome from `+layout.svelte` and lets
	 * EmptyRescue own the rescue messaging — engine composes through
	 * `surface='empty'` with `reason='not-found'` (per ADR-006).
	 *
	 * The earlier version of this file rendered its OWN H1 + subhead above
	 * the EmptyRescue, producing two stacked headlines with conflicting
	 * voice (formal "We can't find that page" + friendly "Looks like that
	 * page wandered off"). Per the 2026-05-02 audit P0 fix we removed the
	 * static block and kept only a small status eyebrow above the rescue.
	 */
	import { page } from '$app/stores';
	import EmptyRescue from '$lib/components/EmptyRescue.svelte';
	import type { LayoutData } from './$types';
	import { getBrand } from '$lib/brand/config';
	import ZoneExecutionEvidence from '$lib/foundation/ZoneExecutionEvidence.svelte';
	import type { RouteZoneExecution } from '$lib/server/route-zone-runtime';

	let { data }: { data: LayoutData } = $props();

	let status = $derived($page.status);
	let isNotFound = $derived(status === 404);
	let statusLabel = $derived(isNotFound ? '404' : `Error ${status ?? ''}`);
	let thrownZoneExecution = $derived(($page.error as { zoneExecution?: RouteZoneExecution } | null)?.zoneExecution ?? null);
	let notFoundZoneExecution = $derived(data.notFoundZoneExecution ?? thrownZoneExecution);

	// Categories list comes from brand config — drives EmptyRescue's static
	// fallback when the engine is slow or unavailable.
	const brandCategories = Object.entries(getBrand().categories).map(([slug, c]) => ({
		slug,
		name: c.displayName,
	}));
</script>

<svelte:head>
	<title>{statusLabel} — {data.brand?.name ?? ''}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-7xl px-6 pt-10">
	<p class="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
		{statusLabel}
	</p>
</div>

{#if notFoundZoneExecution}
	<ZoneExecutionEvidence executions={[notFoundZoneExecution]} />
{/if}

<div class="mx-auto max-w-7xl px-6 py-10 lg:py-12">
	<EmptyRescue
		reason={isNotFound ? 'not-found' : 'not-found'}
		persona={data.personaHint ?? 'gatherer'}
		categories={brandCategories}
	/>
</div>

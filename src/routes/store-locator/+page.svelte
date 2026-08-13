<script lang="ts">
	import type { PageData } from './$types';
	import RuntimeZone from '$lib/foundation/RuntimeZone.svelte';
	import ZoneExecutionEvidence from '$lib/foundation/ZoneExecutionEvidence.svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Store Locator · {data.brand.name}</title>
	<meta
		name="description"
		content="Find a {data.brand.name} store near you. Hours, phone, and pickup readiness for every location."
	/>
</svelte:head>

<div class="mx-auto max-w-5xl px-6 py-12">
	<header class="mb-8">
		<h1 class="font-display text-3xl">Find a {data.brand.name} store</h1>
		{#if data.editorialIntroZone.content}
			<div class="mt-3">
				<RuntimeZone execution={data.zoneExecution} zoneId="locator.editorial-intro" />
			</div>
		{:else}
			<p class="mt-3 text-surface-muted-fg">
				Enter your ZIP code to see the nearest stores, hours, and pickup availability.
			</p>
		{/if}
	</header>

	<form method="GET" class="flex max-w-md gap-2" data-sveltekit-replacestate>
		<input
			type="text"
			name="zip"
			inputmode="numeric"
			pattern="[0-9]{5}"
			placeholder="ZIP code"
			value={data.zipQuery}
			class="flex-1 rounded-sm border border-surface-border bg-surface-card px-3 py-2 text-sm"
			aria-label="ZIP code"
		/>
		<button
			type="submit"
			class="rounded-sm bg-surface-fg px-5 py-2 text-sm font-medium text-surface-bg transition-opacity hover:opacity-85"
		>
			Find stores
		</button>
	</form>

	{#if data.zipQuery && !data.zipResolved}
		<p class="mt-4 text-sm text-surface-muted-fg">
			We couldn't resolve <span class="font-medium">{data.zipQuery}</span>. Try a different
			ZIP, or browse all locations below.
		</p>
	{:else if data.zipResolved && data.zipResolvedLabel}
		<p class="mt-4 text-sm text-surface-muted-fg">
			Showing stores nearest <span class="font-medium">{data.zipResolvedLabel}</span>.
		</p>
	{/if}

	<ul class="mt-8 grid gap-3 md:grid-cols-2">
		{#each data.stores as store (store.id)}
			<li class="rounded-sm border border-surface-border bg-surface-card p-4">
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="font-medium">{store.name}</p>
						<p class="mt-0.5 text-sm text-surface-muted-fg">{store.address}</p>
						<p class="text-sm text-surface-muted-fg">
							{store.city}, {store.state} {store.zip}
						</p>
					</div>
					{#if store.distanceMi !== undefined}
						<span class="shrink-0 text-xs text-surface-muted-fg">
							{store.distanceMi.toFixed(1)} mi
						</span>
					{/if}
				</div>
				<div class="mt-3 flex items-center justify-between text-xs">
					<div class="flex flex-col gap-1 text-surface-muted-fg">
						<span>{store.hours}</span>
						<a href="tel:{store.phone}" class="hover:text-surface-fg">{store.phone}</a>
					</div>
					{#if store.pickupReady}
						<span class="inline-flex items-center gap-1 text-success">
							<span class="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true"></span>
							Pickup ready
						</span>
					{:else}
						<span class="text-surface-muted-fg">Pickup unavailable</span>
					{/if}
				</div>
			</li>
		{/each}
	</ul>

	{#if data.stores.length === 0}
		<p class="mt-8 text-sm text-surface-muted-fg">No stores found.</p>
	{/if}
</div>

<ZoneExecutionEvidence executions={[data.zoneExecution]} />

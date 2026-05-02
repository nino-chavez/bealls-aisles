<script lang="ts">
	type Store = {
		id: string;
		name: string;
		address: string;
		distanceMi?: number;
		hours: string;
		pickupReady: boolean;
		readyByLabel?: string;
	};

	let {
		zip = '',
		stores,
		productName = '',
	}: {
		zip?: string;
		stores: Store[];
		productName?: string;
	} = $props();

	let zipInput = $state(zip);
	let selectedStoreId = $state<string | null>(stores.find((s) => s.pickupReady)?.id ?? null);

	function pick(id: string) {
		selectedStoreId = id;
	}
</script>

<section id="store-locator" class="border-t border-surface-border pt-8" aria-label="Find in store">
	<div class="flex items-baseline justify-between gap-4">
		<h2 class="font-display text-xl">Find in store</h2>
		{#if productName}
			<p class="text-xs text-surface-muted-fg">Pickup availability for {productName}</p>
		{/if}
	</div>

	<form method="GET" action="/store-locator" class="mt-4 flex max-w-sm gap-2">
		<input
			type="text"
			name="zip"
			inputmode="numeric"
			pattern="[0-9]{5}"
			placeholder="ZIP code"
			value={zipInput}
			oninput={(e) => (zipInput = (e.currentTarget as HTMLInputElement).value)}
			class="flex-1 rounded-sm border border-surface-border bg-surface-card px-3 py-2 text-sm"
			aria-label="ZIP code"
		/>
		<button
			type="submit"
			class="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
		>
			Search
		</button>
	</form>

	{#if stores.length > 0}
		<ul class="mt-4 flex flex-col gap-2">
			{#each stores as store (store.id)}
				{@const isSelected = selectedStoreId === store.id}
				<li>
					<button
						type="button"
						onclick={() => pick(store.id)}
						aria-pressed={isSelected}
						class="flex w-full items-start justify-between gap-4 rounded-sm border px-4 py-3 text-left transition-colors
							{isSelected
								? 'border-primary bg-primary/5'
								: 'border-surface-border hover:border-primary/50'}"
					>
						<div>
							<p class="text-sm font-medium">{store.name}{store.distanceMi !== undefined ? ` · ${store.distanceMi.toFixed(1)} mi` : ''}</p>
							<p class="mt-0.5 text-xs text-surface-muted-fg">{store.address}</p>
							<p class="mt-1 text-xs text-surface-muted-fg">{store.hours}</p>
						</div>
						<div class="shrink-0 text-right text-xs">
							{#if store.pickupReady}
								<span class="inline-flex items-center gap-1 text-success">
									<span class="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true"></span>
									Pickup ready
								</span>
								{#if store.readyByLabel}
									<p class="mt-0.5 text-surface-muted-fg">{store.readyByLabel}</p>
								{/if}
							{:else}
								<span class="text-surface-muted-fg">Not available</span>
							{/if}
						</div>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="mt-4 text-sm text-surface-muted-fg">
			Enter a ZIP code to find a nearby store.
			<a href="/store-locator" class="text-primary hover:underline">View all locations</a>
		</p>
	{/if}
</section>

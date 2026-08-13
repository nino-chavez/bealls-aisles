<script lang="ts">
	import { getPickItems, removePick, clearPicks, totalPrice, pickCount } from '$lib/stores/picks.svelte';
	import EmptyRescue from '$lib/components/EmptyRescue.svelte';

	let {
		open = false,
		onclose,
		persona = 'gatherer',
		categories = [],
	}: {
		open: boolean;
		onclose: () => void;
		persona?: string;
		categories?: Array<{ slug: string; name: string }>;
	} = $props();

	let items = $derived(getPickItems());
	let total = $derived(totalPrice());
	let count = $derived(pickCount());

	function handleRemove(id: string) {
		removePick(id);
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex justify-end">
		<!-- Overlay -->
		<button
			class="absolute inset-0 bg-neutral-950/30 backdrop-blur-[2px]"
			onclick={onclose}
			aria-label="Close picks"
		></button>

		<!-- Drawer -->
		<div class="relative z-10 flex h-full w-full max-w-md flex-col bg-surface-bg shadow-xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-surface-border px-6 py-4">
				<div>
					<h2 class="font-display text-lg">Your Picks ({count})</h2>
					{#if count > 0}
						<p class="text-xs text-surface-muted-fg">${total.toLocaleString()} total</p>
					{/if}
				</div>
				<div class="flex items-center gap-3">
					{#if count > 1}
						<a
							href="/compare"
							onclick={onclose}
							class="rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-85"
						>
							Compare
						</a>
					{/if}
					<button onclick={onclose} class="text-surface-muted-fg hover:text-surface-fg" aria-label="Close">
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
					</button>
				</div>
			</div>

			<!-- Items -->
			<div class="flex-1 overflow-y-auto px-6 py-4">
				{#if count === 0}
					<div class="flex flex-col items-center text-center pt-6">
						<p class="text-surface-muted-fg">No picks yet</p>
						<p class="mt-2 text-xs text-surface-muted-fg">Add products to compare or build a set.</p>
						<button onclick={onclose} class="mt-3 text-sm font-medium text-primary hover:text-secondary">
							Continue browsing
						</button>
					</div>
					<!-- PRD-FND-012: fixed rescue band beneath the standard empty copy. -->
					<div class="mt-8 border-t border-surface-border pt-6">
						<EmptyRescue
							reason="empty-wishlist"
							{persona}
							{categories}
						/>
					</div>
				{:else}
					<ul class="divide-y divide-surface-border">
						{#each items as item}
							<li class="flex gap-4 py-4">
								{#if item.image}
									<img src={item.image} alt={item.name} class="h-20 w-20 rounded-sm object-cover" loading="lazy" decoding="async" />
								{:else}
									<div class="h-20 w-20 rounded-sm bg-surface-muted"></div>
								{/if}
								<div class="flex flex-1 flex-col">
									<a href="/product/{item.id}" onclick={onclose} class="text-sm font-medium hover:text-primary transition-colors">{item.name}</a>
									<p class="mt-0.5 text-xs text-surface-muted-fg">{item.category}</p>
									<div class="mt-auto flex items-center justify-between">
										<span class="text-sm font-medium">${(item.salePrice ?? item.price).toLocaleString()}</span>
										<button
											onclick={() => handleRemove(item.id)}
											class="text-xs text-surface-muted-fg hover:text-error transition-colors"
										>
											Remove
										</button>
									</div>
								</div>
							</li>
						{/each}
					</ul>

				{/if}
			</div>

			<!-- Footer -->
			{#if count > 0}
				<div class="border-t border-surface-border px-6 py-4">
					<div class="flex gap-3">
						<a
							href="/compare"
							onclick={onclose}
							class="flex-1 rounded-sm bg-primary py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
						>
							Compare ({count})
						</a>
						<button
							onclick={() => { clearPicks(); }}
							class="rounded-sm border border-surface-border px-4 py-3 text-sm text-surface-muted-fg transition-colors hover:text-surface-fg"
						>
							Clear
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

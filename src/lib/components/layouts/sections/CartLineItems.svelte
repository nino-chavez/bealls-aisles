<script lang="ts">
	/**
	 * CartLineItems — list of cart items with qty stepper + remove.
	 *
	 * Layer: foundation (cart state, not AI composition). The block
	 * receives items from the parent (cart drawer or /cart page) which
	 * sources them from /api/cart. Mutations dispatch a `cart-updated`
	 * window event so the parent can re-fetch.
	 */
	export interface CartLineItem {
		entityId: string;
		productEntityId: number;
		productSlug?: string;
		name: string;
		quantity: number;
		salePrice: { value: number };
		listPrice: { value: number };
		imageUrl: string;
	}

	let {
		items,
		readonly = false,
	}: {
		items: CartLineItem[];
		/** When true, hides qty stepper + remove (e.g. order summary). */
		readonly?: boolean;
	} = $props();

	let busyId = $state<string | null>(null);

	const fmt = (n: number) =>
		`$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

	async function setQuantity(item: CartLineItem, next: number) {
		if (next < 0 || busyId) return;
		busyId = item.entityId;
		try {
			const res = await fetch('/api/cart', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lineItemEntityId: item.entityId, quantity: next }),
			});
			if (!res.ok) throw new Error('Failed to update cart');
			const result = await res.json();
			window.dispatchEvent(new CustomEvent('cart-updated', { detail: { itemCount: result.itemCount } }));
		} catch (err) {
			console.warn('[cart-line-items] update failed', err);
		} finally {
			busyId = null;
		}
	}
</script>

<ul class="divide-y divide-surface-border">
	{#each items as item (item.entityId)}
		<li class="flex gap-4 py-4">
			{#if item.imageUrl}
				<a href={item.productSlug ? `/product/${item.productSlug}` : `#`} class="shrink-0">
					<img
						src={item.imageUrl}
						alt={item.name}
						class="h-20 w-20 rounded-sm object-cover"
						loading="lazy"
					/>
				</a>
			{:else}
				<div class="h-20 w-20 shrink-0 rounded-sm bg-surface-muted"></div>
			{/if}
			<div class="flex flex-1 flex-col">
				<div class="flex items-start justify-between gap-3">
					<a
						href={item.productSlug ? `/product/${item.productSlug}` : `#`}
						class="text-sm font-medium hover:text-primary"
					>
						{item.name}
					</a>
					<div class="text-right">
						{#if item.salePrice.value !== item.listPrice.value}
							<div class="text-sm font-medium text-primary">{fmt(item.salePrice.value)}</div>
							<div class="text-xs text-surface-muted-fg line-through">{fmt(item.listPrice.value)}</div>
						{:else}
							<div class="text-sm font-medium">{fmt(item.salePrice.value)}</div>
						{/if}
					</div>
				</div>

				{#if !readonly}
					<div class="mt-3 flex items-center justify-between">
						<div class="inline-flex items-stretch overflow-hidden rounded-sm border border-surface-border">
							<button
								type="button"
								onclick={() => setQuantity(item, item.quantity - 1)}
								disabled={busyId === item.entityId || item.quantity <= 1}
								aria-label={`Decrease quantity of ${item.name}`}
								class="px-2 text-surface-muted-fg transition-colors hover:bg-surface-muted disabled:opacity-40"
							>
								−
							</button>
							<span class="flex min-w-[2rem] items-center justify-center px-2 text-sm font-medium" aria-live="polite">
								{item.quantity}
							</span>
							<button
								type="button"
								onclick={() => setQuantity(item, item.quantity + 1)}
								disabled={busyId === item.entityId}
								aria-label={`Increase quantity of ${item.name}`}
								class="px-2 text-surface-muted-fg transition-colors hover:bg-surface-muted disabled:opacity-40"
							>
								+
							</button>
						</div>
						<button
							type="button"
							onclick={() => setQuantity(item, 0)}
							disabled={busyId === item.entityId}
							class="text-xs text-surface-muted-fg hover:text-error"
						>
							Remove
						</button>
					</div>
				{:else}
					<p class="mt-1 text-xs text-surface-muted-fg">Qty: {item.quantity}</p>
				{/if}
			</div>
		</li>
	{/each}
</ul>

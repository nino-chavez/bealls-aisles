<script lang="ts">
	import type { CommerceCartLine } from '$lib/commerce/cart-contract';

	export type CartLineItem = CommerceCartLine;

	let {
		items,
		readonly = false,
	}: {
		items: CartLineItem[];
		readonly?: boolean;
	} = $props();

	let busyId = $state<string | null>(null);
	let operationError = $state('');
	const idempotencyKeys = new Map<string, string>();
	const retainKeyFor = new Set(['provider_outcome_unknown', 'session_unavailable', 'operation_in_progress']);

	const fmt = (value: number, currencyCode: string) =>
		new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode || 'USD' }).format(value);

	async function setQuantity(item: CartLineItem, next: number) {
		if (next < 0 || busyId || !item.isMutable) return;
		const operationKey = `${item.lineId}:${next}`;
		const idempotencyKey = idempotencyKeys.get(operationKey) ?? crypto.randomUUID();
		idempotencyKeys.set(operationKey, idempotencyKey);
		busyId = item.lineId;
		operationError = '';
		try {
			const res = await fetch('/api/cart', {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					'Idempotency-Key': idempotencyKey,
				},
				body: JSON.stringify({ lineItemEntityId: item.lineId, quantity: next }),
			});
			const result = await res.json();
			if (result.evidence) {
				window.dispatchEvent(new CustomEvent('commerce-service-outcome', { detail: result.evidence }));
			}
			if (!res.ok || result.evidence?.confirmed !== true) {
				if (!retainKeyFor.has(result.error?.code)) idempotencyKeys.delete(operationKey);
				throw new Error(result.error?.message || 'BigCommerce did not confirm the cart change.');
			}
			idempotencyKeys.delete(operationKey);
			window.dispatchEvent(new CustomEvent('cart-updated', {
				detail: { itemCount: result.itemCount, cart: result.cart },
			}));
		} catch (cause) {
			operationError = cause instanceof Error ? cause.message : 'The cart could not be changed.';
		} finally {
			busyId = null;
		}
	}
</script>

<ul class="divide-y divide-surface-border">
	{#each items as item (item.lineId)}
		<li class="flex gap-4 py-4">
			{#if item.imageUrl}
				<a href={item.productPath} class="shrink-0">
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
					<a href={item.productPath} class="text-sm font-medium hover:text-primary">
						{item.name}
					</a>
					<div class="text-right">
						<div class="text-sm font-medium">{fmt(item.extendedPrice.value, item.extendedPrice.currencyCode)}</div>
						{#if item.quantity > 1}
							<div class="text-xs text-surface-muted-fg">{fmt(item.unitPrice.value, item.unitPrice.currencyCode)} each</div>
						{/if}
					</div>
				</div>

				{#if !readonly}
					<div class="mt-3 flex items-center justify-between">
						<div class="inline-flex items-stretch overflow-hidden rounded-sm border border-surface-border">
							<button
								type="button"
								onclick={() => setQuantity(item, item.quantity - 1)}
								disabled={!item.isMutable || busyId === item.lineId || item.quantity <= 1}
								aria-label={`Decrease quantity of ${item.name}`}
								class="px-2 text-surface-muted-fg transition-colors hover:bg-surface-muted disabled:opacity-40"
							>−</button>
							<span class="flex min-w-[2rem] items-center justify-center px-2 text-sm font-medium" aria-live="polite">
								{item.quantity}
							</span>
							<button
								type="button"
								onclick={() => setQuantity(item, item.quantity + 1)}
								disabled={!item.isMutable || busyId === item.lineId || item.quantity >= 10}
								aria-label={`Increase quantity of ${item.name}`}
								class="px-2 text-surface-muted-fg transition-colors hover:bg-surface-muted disabled:opacity-40"
							>+</button>
						</div>
						<button
							type="button"
							onclick={() => setQuantity(item, 0)}
							disabled={!item.isMutable || busyId === item.lineId}
							class="text-xs text-surface-muted-fg hover:text-error disabled:opacity-40"
						>
							Remove
						</button>
					</div>
					{#if !item.isMutable}
						<p class="mt-2 text-xs text-surface-muted-fg">BigCommerce does not allow this line to be changed.</p>
					{/if}
				{:else}
					<p class="mt-1 text-xs text-surface-muted-fg">Qty: {item.quantity}</p>
				{/if}
			</div>
		</li>
	{/each}
</ul>
{#if operationError}
	<p class="mt-3 text-sm text-error" role="alert">{operationError}</p>
{/if}

<script lang="ts">
	import { getEmitter } from '$lib/signals/emitter';
	import { showToast } from '$lib/components/primitives/Toast.svelte';

	let {
		productEntityId,
		ctaLabel,
		price,
		showQuantity,
		maxQuantity = 10,
		secondaryAction,
		productId,
		productName,
		productCategory,
	}: {
		productEntityId: number;
		ctaLabel: string;
		price: number;
		showQuantity: boolean;
		maxQuantity?: number;
		secondaryAction: 'save-to-picks' | 'find-in-store' | 'none';
		/** Optional context for the signal emitter; defaults to entityId. */
		productId?: string;
		productName?: string;
		productCategory?: string;
	} = $props();

	let quantity = $state(1);
	let isAdding = $state(false);
	let message = $state('');

	const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

	function step(delta: number) {
		quantity = Math.max(1, Math.min(maxQuantity, quantity + delta));
	}

	async function addToCart() {
		isAdding = true;
		message = '';
		try {
			const res = await fetch('/api/cart', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ productEntityId, quantity }),
			});
			if (!res.ok) throw new Error('Failed to add to cart');
			const result = await res.json();
			message = `Added to cart (${result.itemCount} items)`;
			showToast({
				message: `Added to bag — ${productName ?? 'item'}`,
				variant: 'success',
				href: '/cart',
				hrefLabel: 'View cart',
			});

			getEmitter()?.emit('commerce.add_to_cart', {
				productId: productId ?? String(productEntityId),
				entityId: productEntityId,
				price,
				name: productName ?? '',
				category: productCategory ?? '',
				quantity,
			});

			window.dispatchEvent(new CustomEvent('cart-updated', { detail: { itemCount: result.itemCount } }));
			setTimeout(() => (message = ''), 3000);
		} catch {
			message = 'Failed to add to cart';
		} finally {
			isAdding = false;
		}
	}
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-stretch gap-3">
		{#if showQuantity}
			<div class="inline-flex items-stretch overflow-hidden rounded-sm border border-surface-border">
				<button
					type="button"
					onclick={() => step(-1)}
					disabled={quantity <= 1}
					aria-label="Decrease quantity"
					class="px-3 text-surface-muted-fg transition-colors hover:bg-surface-muted disabled:opacity-40"
				>−</button>
				<span class="flex min-w-[2.5rem] items-center justify-center px-2 text-sm font-medium" aria-live="polite">
					{quantity}
				</span>
				<button
					type="button"
					onclick={() => step(1)}
					disabled={quantity >= maxQuantity}
					aria-label="Increase quantity"
					class="px-3 text-surface-muted-fg transition-colors hover:bg-surface-muted disabled:opacity-40"
				>+</button>
			</div>
		{/if}

		<button
			type="button"
			onclick={addToCart}
			disabled={isAdding}
			class="flex-1 rounded-sm bg-primary px-8 py-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
		>
			{isAdding ? 'Adding…' : `${ctaLabel} — ${fmt(price * quantity)}`}
		</button>

		{#if secondaryAction === 'save-to-picks'}
			<a
				href="#picks"
				class="inline-flex items-center justify-center rounded-sm border border-surface-border px-4 py-4 text-sm font-medium text-surface-muted-fg transition-colors hover:border-accent hover:text-accent"
			>
				Save
			</a>
		{:else if secondaryAction === 'find-in-store'}
			<a
				href="#store-locator"
				class="inline-flex items-center justify-center rounded-sm border border-surface-border px-4 py-4 text-sm font-medium text-surface-muted-fg transition-colors hover:border-primary hover:text-primary"
			>
				Find in store
			</a>
		{/if}
	</div>

	{#if message}
		<p class="text-sm {message.includes('Failed') ? 'text-error' : 'text-success'}" aria-live="polite">{message}</p>
	{/if}
</div>

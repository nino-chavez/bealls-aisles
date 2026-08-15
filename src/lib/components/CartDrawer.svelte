<script lang="ts">
	import { onMount } from 'svelte';
	import EmptyRescue from '$lib/components/EmptyRescue.svelte';
	import CartLineItems from '$lib/components/layouts/sections/CartLineItems.svelte';
	import CartSummary from '$lib/components/layouts/sections/CartSummary.svelte';
	import FreeShippingMeter from '$lib/components/layouts/sections/FreeShippingMeter.svelte';
	import PromoCodeEntry from '$lib/components/layouts/sections/PromoCodeEntry.svelte';
	import type { CartLineItem } from '$lib/components/layouts/sections/CartLineItems.svelte';
	import { getBrand } from '$lib/brand/config';

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

	let items = $state<CartLineItem[]>([]);
	let isLoading = $state(false);
	let subtotal = $derived(items.reduce((sum, item) => sum + item.extendedPrice.value, 0));
	let itemCount = $derived(items.reduce((sum, item) => sum + item.quantity, 0));

	const brand = getBrand();
	const freeShippingThreshold = brand.incentives?.freeShippingThresholdMinor != null
		? brand.incentives.freeShippingThresholdMinor / 100
		: null;

	$effect(() => {
		if (open) {
			loadCart();
		}
	});

	onMount(() => {
		const handleUpdate = (event: Event) => {
			const cart = (event as CustomEvent).detail?.cart;
			if (cart) items = cart.lines ?? [];
			else if ((event as CustomEvent).detail?.itemCount === 0) items = [];
		};
		window.addEventListener('cart-updated', handleUpdate);
		return () => window.removeEventListener('cart-updated', handleUpdate);
	});

	async function loadCart() {
		isLoading = true;
		try {
			const res = await fetch('/api/cart');
			const data = await res.json();
			items = data.cart?.lines || [];
		} catch {
			items = [];
		} finally {
			isLoading = false;
		}
	}
</script>

<!-- Backdrop -->
{#if open}
	<div class="fixed inset-0 z-50 flex justify-end">
		<!-- Overlay -->
		<button
			class="absolute inset-0 bg-neutral-950/30 backdrop-blur-[2px]"
			onclick={onclose}
			aria-label="Close cart"
		></button>

		<!-- Drawer -->
		<div class="relative z-10 flex h-full w-full max-w-md flex-col bg-surface-bg shadow-xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-surface-border px-6 py-4">
				<h2 class="font-display text-lg">Cart ({itemCount})</h2>
				<button onclick={onclose} class="text-surface-muted-fg hover:text-surface-fg" aria-label="Close">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
				</button>
			</div>

			<!-- Body -->
			<div class="flex-1 overflow-y-auto px-6 py-4">
				{#if isLoading}
					<div class="animate-pulse space-y-4">
						{#each Array(2) as _}
							<div class="flex gap-4">
								<div class="h-20 w-20 rounded-sm bg-surface-muted"></div>
								<div class="flex-1 space-y-2">
									<div class="h-4 w-32 rounded bg-surface-muted"></div>
									<div class="h-3 w-16 rounded bg-surface-muted"></div>
								</div>
							</div>
						{/each}
					</div>
				{:else if items.length === 0}
					<div class="flex flex-col items-center text-center pt-6">
						<p class="text-surface-muted-fg">Your cart is empty</p>
						<button onclick={onclose} class="mt-3 text-sm font-medium text-primary hover:text-secondary">
							Continue shopping
						</button>
					</div>
					<!-- Fixed rescue band beneath the standard empty copy. -->
					<div class="mt-8 border-t border-surface-border pt-6">
						<EmptyRescue
							reason="empty-cart"
							{persona}
							{categories}
						/>
					</div>
				{:else}
					<!-- Foundation: cart-line-items block (cart state). -->
					<CartLineItems {items} />

					<!-- Foundation: free-shipping-meter (cart state + brand threshold). -->
					{#if freeShippingThreshold !== null}
						<div class="mt-6">
							<FreeShippingMeter current={subtotal} threshold={freeShippingThreshold} />
						</div>
					{/if}

					<!-- Foundation: promo-code-entry (cart state). -->
					<div class="mt-6 border-t border-surface-border pt-6">
						<PromoCodeEntry />
					</div>
				{/if}
			</div>

			<!-- Footer -->
			{#if items.length > 0}
				<div class="border-t border-surface-border px-6 py-4">
					<!-- Foundation: cart-summary (cart state). -->
					<CartSummary
						{subtotal}
						total={subtotal}
						showEstimateNote={false}
					/>
					<a
						href="/checkout"
						class="mt-4 block w-full rounded-sm bg-primary py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
					>
						Checkout
					</a>
					<a
						href="/cart"
						onclick={onclose}
						class="mt-2 block w-full py-2 text-center text-sm text-surface-muted-fg hover:text-surface-fg"
					>
						View full cart
					</a>
				</div>
			{/if}
		</div>
	</div>
{/if}

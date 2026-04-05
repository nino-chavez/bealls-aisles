<script lang="ts">
	let {
		open = false,
		onclose,
	}: {
		open: boolean;
		onclose: () => void;
	} = $props();

	interface CartItem {
		entityId: string;
		productEntityId: number;
		name: string;
		quantity: number;
		salePrice: { value: number };
		listPrice: { value: number };
		imageUrl: string;
	}

	let items = $state<CartItem[]>([]);
	let isLoading = $state(false);
	let total = $derived(items.reduce((sum, item) => sum + item.salePrice.value * item.quantity, 0));
	let itemCount = $derived(items.reduce((sum, item) => sum + item.quantity, 0));

	$effect(() => {
		if (open) {
			loadCart();
		}
	});

	async function loadCart() {
		isLoading = true;
		try {
			const res = await fetch('/api/cart');
			const data = await res.json();
			items = data.cart?.lineItems?.physicalItems || [];
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

			<!-- Items -->
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
					<div class="flex h-48 flex-col items-center justify-center text-center">
						<p class="text-surface-muted-fg">Your cart is empty</p>
						<button onclick={onclose} class="mt-4 text-sm font-medium text-primary hover:text-secondary">
							Continue shopping
						</button>
					</div>
				{:else}
					<ul class="divide-y divide-surface-border">
						{#each items as item}
							<li class="flex gap-4 py-4">
								{#if item.imageUrl}
									<img src={item.imageUrl} alt={item.name} class="h-20 w-20 rounded-sm object-cover" />
								{:else}
									<div class="h-20 w-20 rounded-sm bg-surface-muted"></div>
								{/if}
								<div class="flex flex-1 flex-col">
									<h3 class="text-sm font-medium">{item.name}</h3>
									<p class="mt-1 text-xs text-surface-muted-fg">Qty: {item.quantity}</p>
									<div class="mt-auto">
										{#if item.salePrice.value !== item.listPrice.value}
											<span class="text-sm font-medium text-primary">${item.salePrice.value.toLocaleString()}</span>
											<span class="ml-1 text-xs text-surface-muted-fg line-through">${item.listPrice.value.toLocaleString()}</span>
										{:else}
											<span class="text-sm font-medium">${item.salePrice.value.toLocaleString()}</span>
										{/if}
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<!-- Footer -->
			{#if items.length > 0}
				<div class="border-t border-surface-border px-6 py-4">
					<div class="flex items-center justify-between">
						<span class="text-sm text-surface-muted-fg">Subtotal</span>
						<span class="text-lg font-medium">${total.toLocaleString()}</span>
					</div>
					<p class="mt-1 text-xs text-surface-muted-fg">Shipping and taxes calculated at checkout</p>
					<a
						href="/checkout"
						class="mt-4 block w-full rounded-sm bg-surface-fg py-3 text-center text-sm font-semibold text-surface-bg transition-opacity hover:opacity-85"
					>
						Checkout
					</a>
					<button
						onclick={onclose}
						class="mt-2 block w-full py-2 text-center text-sm text-surface-muted-fg hover:text-surface-fg"
					>
						Continue shopping
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

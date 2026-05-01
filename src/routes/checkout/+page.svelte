<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Checkout</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-6 py-16">
	{#if data.reason === 'empty'}
		<h1 class="font-display text-2xl">Your cart is empty</h1>
		<p class="mt-3 text-surface-muted-fg">Add some items before checking out.</p>
		<a href="/" class="mt-6 inline-block text-sm font-medium text-primary hover:text-secondary">
			Continue shopping
		</a>
	{:else}
		<!-- Demo-fallback splash: BC Optimized Checkout isn't configured for
		     this channel, or the redirect URL mint failed. The shopper would
		     proceed to real BC checkout in production. -->
		<div class="rounded-sm border border-surface-border bg-surface-card p-8">
			<div class="text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">
				Demo checkout
			</div>
			<h1 class="mt-2 font-display text-2xl">Order would proceed to BC Optimized Checkout</h1>
			<p class="mt-4 text-sm text-surface-muted-fg">
				In production, this CTA hands off to BigCommerce's Optimized One-Page Checkout
				with cart contents and customer context attached. Hosted by BigCommerce, branded
				per merchant, PCI-compliant by default.
			</p>
			<div class="mt-6 flex items-center justify-between rounded-sm bg-surface-muted px-4 py-3">
				<span class="text-sm text-surface-muted-fg">{data.itemCount} item{data.itemCount === 1 ? '' : 's'}</span>
				<span class="font-medium">${data.subtotal.toLocaleString()}</span>
			</div>
			<p class="mt-6 text-xs text-surface-muted-fg">
				This demo channel doesn't have Optimized Checkout enabled, so we surface the
				handoff intent here instead of dead-ending on a 404.
			</p>
			<a
				href="/"
				class="mt-6 inline-block rounded-sm bg-surface-fg px-6 py-3 text-sm font-semibold text-surface-bg hover:opacity-85"
			>
				Continue shopping
			</a>
		</div>
	{/if}
</div>

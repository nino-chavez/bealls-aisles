<script lang="ts">
	import type { PageData } from './$types';
	import AssuranceStripCheckout from '$lib/components/layouts/sections/AssuranceStripCheckout.svelte';
	import ZoneExecutionEvidence from '$lib/foundation/ZoneExecutionEvidence.svelte';
	import RuntimeEnvelopeZone from '$lib/foundation/RuntimeEnvelopeZone.svelte';
	import type { RuntimeZoneEnvelopeView } from '$lib/foundation/runtime-zone-envelope';

	let { data }: { data: PageData } = $props();

	type AssuranceItem = { icon: string; label: string; body?: string };
	type AssuranceVariant = 'first-time' | 'returning' | 'loyalty-known';

	let assuranceItems = $state<AssuranceItem[]>([]);
	let assuranceVariant = $state<AssuranceVariant>('first-time');
	let assuranceZone = $state<RuntimeZoneEnvelopeView | null>(null);
	const fallback = data.zoneExecution.decisions.find((decision) => decision.zoneId === 'checkout.assurance-strip')?.resolution;
	if (fallback?.content && typeof fallback.content === 'object' && 'props' in fallback.content) {
		const props = (fallback.content as { props: { items: AssuranceItem[]; variant: AssuranceVariant } }).props;
		assuranceItems = props.items;
		assuranceVariant = props.variant;
		assuranceZone = {
			zoneId: 'checkout.assurance-strip',
			source: fallback.source,
			terminal: `materialized-${fallback.source}`,
			content: fallback.content as { component: string; props: Record<string, unknown> },
		};
	}

</script>

<svelte:head>
	<title>Checkout</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-6 py-12">
	{#if data.reason === 'empty'}
		<div data-empty-state="empty-checkout">
			<h1 class="font-display text-2xl">Your cart is empty</h1>
			<p class="mt-3 text-surface-muted-fg">Add some items before checking out.</p>
			<a href="/" class="mt-6 inline-block text-sm font-medium text-primary hover:text-secondary">
				Continue shopping
			</a>
		</div>
	{:else}
		<div class="mb-8 flex items-center justify-between">
			<h1 class="font-display text-2xl">Almost done</h1>
			<a href="/cart" class="text-sm text-surface-muted-fg hover:text-surface-fg">← Edit cart</a>
		</div>

		<!-- Order recap (foundation primitive — cart state). -->
		<div class="rounded-sm border border-surface-border bg-surface-card px-6 py-4">
			<div class="flex items-center justify-between text-sm">
				<span class="text-surface-muted-fg">{data.itemCount} item{data.itemCount === 1 ? '' : 's'}</span>
				<span class="font-medium">${data.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
			</div>
		</div>

		<!-- Policy-authorized assurance strip with exact envelope provenance. -->
		{#if assuranceZone}
			<RuntimeEnvelopeZone view={assuranceZone} className="mt-8">
				<AssuranceStripCheckout items={assuranceItems} variant={assuranceVariant} />
			</RuntimeEnvelopeZone>
		{/if}

		<!-- Foundation: BC Optimized Checkout handoff (FND-010). -->
		<div class="mt-10 border-t border-surface-border pt-8">
			{#if data.reason === 'handoff' && data.checkoutUrl}
				<a
					href={data.checkoutUrl}
					class="block w-full rounded-sm bg-primary py-4 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
				>
					Continue to secure checkout
				</a>
				<p class="mt-3 text-center text-xs text-surface-muted-fg">
					You'll complete payment on BigCommerce's hosted checkout. Your cart and contact info travel with you.
				</p>
			{:else}
				<div class="rounded-sm border border-surface-border bg-surface-muted px-6 py-5">
					<div class="text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">Demo checkout</div>
					<p class="mt-2 text-sm">
						In production, this CTA hands off to BigCommerce's Optimized One-Page Checkout
						with cart contents and customer context attached. This demo channel doesn't have
						Optimized Checkout enabled.
					</p>
					<a
						href="/"
						class="mt-4 inline-block rounded-sm bg-primary px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
					>
						Continue shopping
					</a>
				</div>
			{/if}
		</div>

	{/if}
</div>

<ZoneExecutionEvidence executions={data.emptyZoneExecution ? [data.zoneExecution, data.emptyZoneExecution] : [data.zoneExecution]} />

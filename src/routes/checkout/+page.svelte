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
	let checkoutPending = $state(false);
	let checkoutError = $state('');
	let checkoutIdempotencyKey: string | null = null;
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

	async function continueToCheckout() {
		checkoutIdempotencyKey ??= crypto.randomUUID();
		checkoutPending = true;
		checkoutError = '';
		try {
			const response = await fetch('/api/checkout/redirect', {
				method: 'POST',
				headers: { 'Idempotency-Key': checkoutIdempotencyKey },
			});
			const result = await response.json();
			if (result.evidence) window.dispatchEvent(new CustomEvent('commerce-service-outcome', { detail: result.evidence }));
			if (!response.ok || result.evidence?.confirmed !== true || typeof result.redirectUrl !== 'string') {
				if (!['provider_outcome_unknown', 'session_unavailable', 'operation_in_progress'].includes(result.error?.code)) checkoutIdempotencyKey = null;
				throw new Error(result.error?.message || 'BigCommerce did not confirm checkout handoff.');
			}
			window.location.assign(result.redirectUrl);
		} catch (cause) {
			checkoutError = cause instanceof Error ? cause.message : 'Hosted checkout is temporarily unavailable.';
			checkoutPending = false;
		}
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
	{:else if data.reason === 'disabled'}
		<div class="rounded-sm border border-surface-border bg-surface-card p-8" data-checkout-state="not-connected">
			<h1 class="font-display text-2xl">Hosted checkout is not connected</h1>
			<p class="mt-3 text-surface-muted-fg">No checkout URL, order, payment authorization, account, or subscription was created.</p>
			<a href="/cart" class="mt-6 inline-block text-sm font-medium text-primary hover:text-secondary">Return to cart</a>
		</div>
	{:else if data.reason === 'unavailable'}
		<div class="rounded-sm border border-surface-border bg-surface-card p-8" data-checkout-state="unavailable">
			<h1 class="font-display text-2xl">Checkout is temporarily unavailable</h1>
			<p class="mt-3 text-surface-muted-fg">BigCommerce did not confirm the current cart. Refresh the cart before trying again.</p>
			<a href="/cart" class="mt-6 inline-block text-sm font-medium text-primary hover:text-secondary">Refresh cart</a>
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
			{#if data.reason === 'handoff'}
				<button
					type="button"
					onclick={continueToCheckout}
					disabled={checkoutPending || data.services.checkout !== 'bigcommerce_hosted_handoff'}
					class="block w-full rounded-sm bg-primary py-4 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
				>
					{checkoutPending ? 'Opening secure checkout…' : 'Continue to secure checkout'}
				</button>
				<p class="mt-3 text-center text-xs text-surface-muted-fg">
					BigCommerce will collect contact, shipping, and payment details on its hosted checkout. Aisles does not receive payment credentials.
				</p>
			{:else}
				<div class="rounded-sm border border-surface-border bg-surface-muted px-6 py-5">
					<div class="text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">Hosted checkout not configured</div>
					<p class="mt-2 text-sm">
						The cart is real, but this channel has not been authorized for a BigCommerce hosted-checkout handoff.
						No checkout URL, order, payment authorization, or subscription was created.
					</p>
					<a
						href="/"
						class="mt-4 inline-block rounded-sm bg-primary px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
					>
						Continue shopping
					</a>
				</div>
			{/if}
			{#if checkoutError}<p class="mt-3 text-center text-sm text-error" role="alert">{checkoutError}</p>{/if}
		</div>

	{/if}
</div>

<ZoneExecutionEvidence executions={data.emptyZoneExecution ? [data.zoneExecution, data.emptyZoneExecution] : [data.zoneExecution]} />

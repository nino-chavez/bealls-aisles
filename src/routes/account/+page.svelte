<script lang="ts">
	import type { PageData } from './$types';
	import ZoneExecutionEvidence from '$lib/foundation/ZoneExecutionEvidence.svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Account — {data.brandName}</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-6 py-12">
	<div class="rounded-sm border border-surface-border bg-surface-card p-8" data-account-state={data.services.account}>
		<p class="text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">Provider boundary</p>
		<h1 class="mt-2 font-display text-3xl tracking-tight">Customer accounts are not connected</h1>
		<p class="mt-4 max-w-2xl text-surface-muted-fg">
			This Aisles storefront has no customer session, saved addresses, order history, payment instruments, or recurring schedule.
			The earlier sample member and order records have been removed.
		</p>

		<dl class="mt-8 grid gap-4 sm:grid-cols-2">
			<div class="rounded-sm border border-surface-border p-4">
				<dt class="text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">Account</dt>
				<dd class="mt-1 text-sm">Not configured</dd>
			</div>
			<div class="rounded-sm border border-surface-border p-4">
				<dt class="text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">Orders</dt>
				<dd class="mt-1 text-sm">Creation is not exposed in Aisles</dd>
			</div>
			<div class="rounded-sm border border-surface-border p-4">
				<dt class="text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">Payment</dt>
				<dd class="mt-1 text-sm">Owned by hosted checkout</dd>
			</div>
			<div class="rounded-sm border border-surface-border p-4">
				<dt class="text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">Subscriptions</dt>
				<dd class="mt-1 text-sm">Provider and merchant policy are not configured</dd>
			</div>
		</dl>

		<p class="mt-8 text-sm text-surface-muted-fg">
			Remaining merchant decision: choose the customer identity and recurring-commerce providers, then authorize their configuration as separate work.
		</p>
		<a href="/" class="mt-6 inline-block rounded-sm bg-primary px-6 py-3 text-sm font-semibold text-white hover:opacity-90">
			Continue shopping
		</a>
	</div>
</div>

<ZoneExecutionEvidence executions={[data.zoneExecution]} />

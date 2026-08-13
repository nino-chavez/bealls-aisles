<script lang="ts">
	import type { PageData } from './$types';
	import ForYouRow from '$lib/components/layouts/sections/ForYouRow.svelte';
	import { getPickItems } from '$lib/stores/picks.svelte';
	import ZoneExecutionEvidence from '$lib/foundation/ZoneExecutionEvidence.svelte';

	let { data }: { data: PageData } = $props();

	const navItems = [
		{ id: 'dashboard', label: 'Dashboard', href: '/account' },
		{ id: 'orders', label: 'Orders', href: '/account/orders' },
		{ id: 'addresses', label: 'Addresses', href: '/account/addresses' },
		{ id: 'wishlist', label: 'Wishlist', href: '/account/wishlist' },
		{ id: 'loyalty', label: 'Bealls Bucks', href: '/account/loyalty' },
		{ id: 'settings', label: 'Settings', href: '/account/settings' },
	];

	let pickList = $derived(getPickItems());
	let pickPreview = $derived(pickList.slice(0, 4));
</script>

<svelte:head>
	<title>My Account — {data.brandName}</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-6 py-8">
	<div class="grid gap-8 lg:grid-cols-[240px_1fr]">
		<!-- Sidebar -->
		<aside class="lg:border-r lg:border-surface-border lg:pr-6">
			<div class="mb-8">
				<p class="text-[10px] font-semibold uppercase tracking-wider text-surface-muted-fg">Member</p>
				<p class="mt-1 font-display text-lg">Hi, {data.customer.firstName}</p>
				<p class="text-xs text-surface-muted-fg">Since {data.customer.memberSince}</p>
			</div>

			<nav class="flex flex-col gap-1 text-sm">
				{#each navItems as item}
					<a
						href={item.href}
						class="rounded-sm px-3 py-2 transition-colors {item.id === 'dashboard'
							? 'bg-surface-muted font-medium text-surface-fg'
							: 'text-surface-muted-fg hover:bg-surface-muted hover:text-surface-fg'}"
					>
						{item.label}
					</a>
				{/each}
			</nav>
		</aside>

		<!-- Main -->
		<div>
			<h1 class="font-display text-3xl tracking-tight">Welcome back, {data.customer.firstName}</h1>
			<p class="mt-2 text-surface-muted-fg">Here's what's happening with your account.</p>

			<!-- 4-card dashboard grid (placeholder for account.dashboard-pick.{1..4} zones) -->
			<div class="mt-8 grid gap-4 sm:grid-cols-2">
				<!-- Card 1: Recent orders -->
				<section class="rounded-sm border border-surface-border bg-surface-card p-5">
					<header class="flex items-baseline justify-between">
						<h2 class="font-display text-base">Recent orders</h2>
						<a href="/account/orders" class="text-xs text-primary hover:underline">View all</a>
					</header>
					<ul class="mt-3 divide-y divide-surface-border text-sm">
						{#each data.recentOrders as order}
							<li class="flex items-center justify-between py-2">
								<div>
									<p class="font-medium">{order.id}</p>
									<p class="text-xs text-surface-muted-fg">{order.placed} · {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}</p>
								</div>
								<div class="text-right">
									<p class="text-xs text-surface-muted-fg">{order.status}</p>
									<p class="text-sm font-semibold">${order.total.toFixed(2)}</p>
								</div>
							</li>
						{/each}
					</ul>
				</section>

				<!-- Card 2: Tier status / Bealls Bucks -->
				<section class="rounded-sm border border-surface-border bg-surface-card p-5">
					<header class="flex items-baseline justify-between">
						<h2 class="font-display text-base">Bealls Bucks</h2>
						<a href="/account/loyalty" class="text-xs text-primary hover:underline">Details</a>
					</header>
					<div class="mt-3">
						<p class="text-3xl font-display text-primary">${data.customer.bucksBalance}</p>
						<p class="text-xs text-surface-muted-fg">Available to spend</p>
					</div>
					<div class="mt-4">
						<div class="flex items-baseline justify-between text-xs">
							<span class="font-medium">{data.customer.tier.current} tier</span>
							<span class="text-surface-muted-fg">{data.customer.tier.unitsToNext} pts to {data.customer.tier.next}</span>
						</div>
						<div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
							<div class="h-full w-[60%] bg-accent"></div>
						</div>
					</div>
				</section>

				<!-- Card 3: Wishlist preview (uses existing picks store) -->
				<section class="rounded-sm border border-surface-border bg-surface-card p-5 sm:col-span-2">
					<header class="flex items-baseline justify-between">
						<h2 class="font-display text-base">Your picks</h2>
						<a href="/account/wishlist" class="text-xs text-primary hover:underline">View all ({pickList.length})</a>
					</header>
					{#if pickPreview.length > 0}
						<div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
							{#each pickPreview as pick}
								<a href="/product/{pick.id}" class="block">
									<div class="aspect-square overflow-hidden bg-surface-muted">
										{#if pick.image}
											<img src={pick.image} alt={pick.name} loading="lazy" class="h-full w-full object-cover" />
										{/if}
									</div>
									<p class="mt-2 truncate text-xs">{pick.name}</p>
								</a>
							{/each}
						</div>
					{:else}
						<p class="mt-3 text-sm text-surface-muted-fg">You haven't saved any picks yet. Tap the heart on any product to save it here.</p>
					{/if}
				</section>
			</div>

			<!-- For-You row (signal-driven personalization stub) -->
			<div class="mt-12">
				<ForYouRow
					title="Picked for you"
					reasoning="Based on your recent browsing"
					products={data.forYouProducts}
				/>
			</div>
		</div>
	</div>
</div>

<ZoneExecutionEvidence executions={[data.zoneExecution]} />

<script lang="ts">
	import { goto } from '$app/navigation';
	import { getEmitter } from '$lib/signals/emitter';

	import { getBrand } from '$lib/brand/config';

	let { cartCount = 0, picksCount = 0, onCartClick, onPicksClick, brandName = 'Aisles', brandMode = 'storefront' }: {
		cartCount?: number;
		picksCount?: number;
		onCartClick?: () => void;
		onPicksClick?: () => void;
		brandName?: string;
		brandMode?: 'storefront' | 'content';
	} = $props();

	const isContent = $derived(brandMode === 'content');

	const brand = getBrand();
	const navItems = Object.entries(brand.categories).map(([slug, config]) => ({
		label: config.displayName,
		href: `/category/${slug}`,
	}));

	let searchOpen = $state(false);
	let searchQuery = $state('');

	function handleSearch(e: Event) {
		e.preventDefault();
		if (searchQuery.trim()) {
			getEmitter()?.emit('nav.search', {
				query: searchQuery.trim(),
			});
			goto(`/search?q=${encodeURIComponent(searchQuery.trim())}&dev=true`);
			searchOpen = false;
			searchQuery = '';
		}
	}
</script>

<header class="sticky top-0 z-50 border-b border-surface-border bg-surface-bg/95 backdrop-blur-sm">
	<div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-6 lg:h-16">
		<!-- Logo — brand-red wordmark per the path-B real-Bealls reconciliation
		     (real bealls.com renders the lowercase wordmark in cherry red `#aa182c`,
		     not flat black). -->
		<a href="/" class="font-display text-2xl text-primary transition-opacity hover:opacity-80">
			{brandName}
		</a>

		<!-- Category Nav -->
		<nav class="hidden items-center gap-8 md:flex">
			{#each navItems as item}
				<a
					href={item.href}
					class="text-[0.8125rem] font-medium tracking-wide text-surface-muted-fg transition-colors hover:text-surface-fg"
				>
					{item.label}
				</a>
			{/each}
		</nav>

		<!-- Right side -->
		<div class="flex items-center gap-3">
			{#if isContent}
				<!-- Content-mode: locator + menu only, no search/account/cart -->
				<a
					href="#locator"
					class="flex h-9 items-center gap-2 rounded-sm border border-surface-border px-3 text-[0.8125rem] font-medium text-surface-muted-fg transition-colors hover:border-primary hover:text-primary"
					aria-label="Find a Store"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
					<span>Find a Store</span>
				</a>
				<button
					class="flex h-9 w-9 items-center justify-center text-surface-muted-fg transition-colors hover:text-surface-fg"
					aria-label="Menu"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
				</button>
			{:else}
			<!-- Search -->
			{#if searchOpen}
				<form onsubmit={handleSearch} class="flex items-center">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search products..."
						class="h-9 w-48 rounded-sm border border-surface-border bg-surface-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-64"
						autofocus
					/>
					<button
						type="button"
						onclick={() => { searchOpen = false; searchQuery = ''; }}
						class="ml-2 text-surface-muted-fg hover:text-surface-fg"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
					</button>
				</form>
			{:else}
				<button
					onclick={() => searchOpen = true}
					class="flex h-9 items-center gap-2 rounded-sm border border-surface-border bg-surface-card px-3 text-[0.8125rem] text-surface-muted-fg transition-colors hover:border-neutral-400 hover:text-surface-fg sm:w-56"
					aria-label="Search products"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
					<span class="hidden sm:inline">Search</span>
				</button>
			{/if}

			<!-- Account -->
			<a
				href="/account"
				class="flex h-9 w-9 items-center justify-center text-surface-muted-fg transition-colors hover:text-surface-fg"
				aria-label="Account"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
			</a>

			<!-- Picks -->
			<button
				onclick={() => onPicksClick?.()}
				class="relative flex h-9 w-9 items-center justify-center text-surface-muted-fg transition-colors hover:text-surface-fg"
				aria-label="Your picks ({picksCount} items)"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/></svg>
				{#if picksCount > 0}
					<span class="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[0.625rem] font-semibold text-white">
						{picksCount}
					</span>
				{/if}
			</button>

			<!-- Cart -->
			<button
				onclick={() => onCartClick?.()}
				class="relative flex h-9 w-9 items-center justify-center text-surface-muted-fg transition-colors hover:text-surface-fg"
				aria-label="Cart ({cartCount} items)"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
				{#if cartCount > 0}
					<span class="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[0.625rem] font-semibold text-white">
						{cartCount}
					</span>
				{/if}
			</button>
			{/if}
		</div>
	</div>
</header>


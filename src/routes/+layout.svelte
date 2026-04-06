<script lang="ts">
	import '../app.css';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import Nav from '$lib/components/Nav.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import CartDrawer from '$lib/components/CartDrawer.svelte';
	import { initEmitter, destroyEmitter, getEmitter } from '$lib/signals/emitter';
	import type { LayoutData } from './$types';

	let { children, data }: { children: any; data: LayoutData } = $props();
	let brandName = $derived(data.brand?.name ?? 'Haven');
	let brandTagline = $derived(data.brand?.tagline ?? '');
	let brandFooterNote = $derived(data.brand?.footerNote ?? '');
	let cartCount = $state(0);
	let cartOpen = $state(false);

	// Observe dashboard uses its own chrome-less shell
	let isObserve = $derived($page.url.pathname.startsWith('/observe'));

	// ─── Signal Emitter (client-side singleton) ────────────────────
	$effect(() => {
		initEmitter();
		return () => destroyEmitter();
	});

	afterNavigate(({ to, from }) => {
		const emitter = getEmitter();
		if (!emitter || !to?.url) return;

		const category = to.url.pathname.match(/^\/category\/([^/]+)/)?.[1] || null;
		if (category) {
			emitter.emit('nav.category_view', {
				category,
				fromCategory: from?.url.pathname.match(/^\/category\/([^/]+)/)?.[1] || null,
				fromPage: from?.url.pathname || null,
			});
		}
	});

	// ─── Cart ──────────────────────────────────────────────────────
	$effect(() => {
		fetch('/api/cart')
			.then((res) => res.json())
			.then((data) => { cartCount = data.itemCount || 0; })
			.catch(() => {});

		const handleCartUpdate = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail?.itemCount !== undefined) {
				cartCount = detail.itemCount;
			}
		};

		window.addEventListener('cart-updated', handleCartUpdate);
		return () => window.removeEventListener('cart-updated', handleCartUpdate);
	});

	function openCart() {
		cartOpen = true;
	}

	function closeCart() {
		cartOpen = false;
		fetch('/api/cart')
			.then((res) => res.json())
			.then((data) => { cartCount = data.itemCount || 0; })
			.catch(() => {});
	}
</script>

{#if isObserve}
	{@render children()}
{:else}
	<div class="flex min-h-screen flex-col">
		<Nav {cartCount} onCartClick={openCart} {brandName} />
		<main class="flex-1">
			{@render children()}
		</main>
		<Footer {brandName} footerNote={brandFooterNote} tagline={brandTagline} />
	</div>

	<CartDrawer open={cartOpen} onclose={closeCart} />
{/if}

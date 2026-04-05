<script lang="ts">
	import '../app.css';
	import Nav from '$lib/components/Nav.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import CartDrawer from '$lib/components/CartDrawer.svelte';

	let { children } = $props();
	let cartCount = $state(0);
	let cartOpen = $state(false);

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
		// Refresh cart count
		fetch('/api/cart')
			.then((res) => res.json())
			.then((data) => { cartCount = data.itemCount || 0; })
			.catch(() => {});
	}
</script>

<div class="flex min-h-screen flex-col">
	<Nav {cartCount} onCartClick={openCart} />
	<main class="flex-1">
		{@render children()}
	</main>
	<Footer />
</div>

<CartDrawer open={cartOpen} onclose={closeCart} />

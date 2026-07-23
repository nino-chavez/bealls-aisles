<script lang="ts">
	/**
	 * /test/p0-blocks — visual fixture for the PRD-ENG-020 P0 block set.
	 * Renders synthetic props for each new marketing/capture/service block.
	 */
	import EventCountdown from '$lib/components/layouts/sections/EventCountdown.svelte';
	import BrandSpotlight from '$lib/components/layouts/sections/BrandSpotlight.svelte';
	import TrendShop from '$lib/components/layouts/sections/TrendShop.svelte';
	import EmailCaptureInline from '$lib/components/layouts/sections/EmailCaptureInline.svelte';
	import ServiceCalloutsGrid from '$lib/components/layouts/sections/ServiceCalloutsGrid.svelte';
	import LocatorStrip from '$lib/components/layouts/sections/LocatorStrip.svelte';

	// Future timestamp (~3 days out) so the countdown renders.
	const futureTs = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
	// Past timestamp — countdown should hide.
	const pastTs = new Date(Date.now() - 3600 * 1000).toISOString();
</script>

<svelte:head>
	<title>P0 blocks fixture · Aisles</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-6 py-10">
	<header class="mb-10 border-b border-surface-muted pb-6">
		<h1 class="font-display text-3xl font-semibold tracking-tight text-surface-fg">
			P0 marketing / capture / service blocks
		</h1>
		<p class="mt-2 text-sm text-surface-muted-fg">
			Visual fixture for the PRD-ENG-020 block set (composition-taxonomy.md Appendix A).
		</p>
	</header>

	<section class="mb-12">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">
			event-countdown
		</h2>
		<EventCountdown
			eyebrow="MEMORIAL DAY WEEKEND"
			headline="Up to 70% off — Fri thru Mon"
			body="Hand-picked deals across every category."
			endsAt={futureTs}
			ctaLabel="Shop the Event"
			ctaHref="/category/clearance"
		/>
		<p class="mb-2 text-xs text-surface-muted-fg">Past timestamp (renders nothing):</p>
		<EventCountdown
			headline="Already over"
			endsAt={pastTs}
		/>
	</section>

	<section class="mb-12">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">
			brand-spotlight
		</h2>
		<BrandSpotlight
			brandName="Reel Legends"
			eyebrow="FEATURED BRAND"
			headline="Built for the dock"
			body="Performance-fishing apparel from a Florida original. Quick-dry fabrics, sun-shielding fits, and details earned on saltwater."
			image="https://picsum.photos/seed/reel/900/700"
			ctaLabel="Shop Reel Legends"
			ctaHref="/category/reel-legends"
		/>
	</section>

	<section class="mb-12">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">
			trend-shop
		</h2>
		<TrendShop
			sectionLabel="SHOP THE TREND"
			headline="The Vacation Shop"
			image="https://picsum.photos/seed/vacation/1600/700"
			ctaLabel="Shop Vacation"
			ctaHref="/category/vacation"
		/>
	</section>

	<section class="mb-12">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">
			email-capture-inline
		</h2>
		<EmailCaptureInline
			eyebrow="JOIN US"
			headline="Sign up for emails"
			body="Be the first to know about new arrivals, events, and rewards."
			offerCopy="Use code WELCOME10 — $10 off your first order."
			ctaLabel="Sign Up"
			privacyNote="We never share your email. Unsubscribe anytime."
		/>
	</section>

	<section class="mb-12">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">
			service-callouts-grid (4-up)
		</h2>
		<ServiceCalloutsGrid
			columns={4}
			callouts={[
				{ icon: '🚚', label: 'Free shipping', body: 'On orders $99+' },
				{ icon: '↩️', label: 'Easy returns', body: '30 days, in store or by mail' },
				{ icon: '🏬', label: 'Buy online, pick up', body: 'Ready in 2 hours' },
				{ icon: '💎', label: 'Bealls Bucks rewards', body: 'Earn on every order' },
			]}
		/>

		<h2 class="mt-8 mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">
			service-callouts-grid (3-up, content mode)
		</h2>
		<ServiceCalloutsGrid
			columns={3}
			callouts={[
				{ icon: '📍', label: 'Find a store', body: 'Locator with hours + directions' },
				{ icon: '✉️', label: 'Newsletter', body: 'Be first to know about new stores' },
				{ icon: '🤝', label: 'In-store help', body: 'Ask any associate' },
			]}
		/>
	</section>

	<section class="mb-12">
		<h2 class="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-surface-muted-fg">
			locator-strip
		</h2>
		<LocatorStrip
			eyebrow="FIND A STORE"
			headline="Visit your nearest Bealls"
			body="Pickup, returns, and styling help in person."
			ctaLabel="Find a Store"
			ctaHref="/store-locator"
		/>
	</section>
</div>

<script lang="ts">
	/**
	 * Brand-strip cross-banner nav for the Bealls family.
	 * Renders only when the active brand is one of: bealls, beallsflorida, homecentric.
	 *
	 * Each banner runs as its own Vercel project. When clicked, an inactive tab
	 * links to that banner's deployment. The active banner's tab is non-navigating.
	 */

	let { activeBrandId }: { activeBrandId: string } = $props();

	const SISTER_URLS: Record<string, string> = {
		bealls: 'https://aisles-demo-1-signal-x-studio-labs.vercel.app',
		beallsflorida: 'https://aisles-demo-2-signal-x-studio-labs.vercel.app',
		homecentric: 'https://aisles-demo-3-signal-x-studio-labs.vercel.app',
	};

	const banners = [
		{ id: 'bealls', label: 'bealls' },
		{ id: 'beallsflorida', label: 'Bealls Florida' },
		{ id: 'homecentric', label: 'HOME centric' },
	];

	const isFamily = $derived(banners.some((b) => b.id === activeBrandId));
</script>

{#if isFamily}
	<div class="bg-accent text-white">
		<div class="mx-auto flex max-w-7xl items-stretch gap-px px-2">
			{#each banners as banner}
				{@const active = banner.id === activeBrandId}
				{#if active}
					<span
						class="flex-1 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider bg-primary text-white"
						aria-current="page"
					>
						{banner.label}
					</span>
				{:else}
					<a
						href={SISTER_URLS[banner.id]}
						class="flex-1 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider transition-colors bg-accent text-white/75 hover:bg-accent hover:text-white"
					>
						{banner.label}
					</a>
				{/if}
			{/each}

			<!-- Right-side utility links -->
			<div class="flex items-center gap-4 px-4 text-[11px] font-medium uppercase tracking-wider text-white/80">
				<a href="/store-locator" class="hover:text-white">Find a Store</a>
				<a href="#help" class="hover:text-white">Help</a>
			</div>
		</div>
	</div>
{/if}

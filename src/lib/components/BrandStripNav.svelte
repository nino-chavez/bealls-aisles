<script lang="ts">
	/**
	 * Brand-strip cross-banner nav for the Bealls family.
	 * Renders only when the active brand is one of: bealls, beallsflorida, homecentric.
	 *
	 * In a production setting each banner runs as its own Vercel project on its own
	 * URL, and the tabs link cross-domain. For the bealls-aisles fork running locally
	 * with one BRAND_ID at a time, the inactive tabs are visual representations only
	 * (clicking would not switch brands without restarting the dev server).
	 */

	let { activeBrandId }: { activeBrandId: string } = $props();

	const banners = [
		{ id: 'bealls', label: 'bealls', href: '#bealls' },
		{ id: 'beallsflorida', label: 'Bealls Florida', href: '#beallsflorida' },
		{ id: 'homecentric', label: 'HOME centric', href: '#homecentric' },
	];

	const isFamily = $derived(banners.some((b) => b.id === activeBrandId));
</script>

{#if isFamily}
	<div class="bg-black text-white">
		<div class="mx-auto flex max-w-7xl items-stretch gap-px px-2">
			{#each banners as banner}
				{@const active = banner.id === activeBrandId}
				<a
					href={banner.href}
					class="flex-1 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider transition-colors
						{active
							? 'bg-primary text-white'
							: 'bg-black text-white/70 hover:text-white'}"
					aria-current={active ? 'page' : undefined}
				>
					{banner.label}
				</a>
			{/each}

			<!-- Right-side utility links -->
			<div class="flex items-center gap-4 px-4 text-[11px] font-medium uppercase tracking-wider text-white/80">
				<a href="#locator" class="hover:text-white">Find a Store</a>
				<a href="#help" class="hover:text-white">Help</a>
			</div>
		</div>
	</div>
{/if}

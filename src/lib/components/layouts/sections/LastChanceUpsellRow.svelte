<script lang="ts">
	/**
	 * LastChanceUpsellRow — AI-composed upsell row above checkout CTA.
	 *
	 * Layer: engine (AI composition target). The AI emits ProductRef[]
	 * via the cart/checkout zone schema; the parent resolves the refs
	 * to full Product objects and passes them in.
	 *
	 * Today: ranked by persona-fit score from enrichment. Phase 3
	 * (PRD-ENG-019, ADR-008 Phase B) swaps to tag-overlap when the
	 * neighborhood query lands.
	 */
	import type { Product } from '$lib/types';

	let {
		title,
		products,
	}: {
		title: string;
		products: Product[];
	} = $props();

	const fmt = (n: number) =>
		`$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
</script>

{#if products.length > 0}
	<div>
		<h3 class="text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">{title}</h3>
		<ul class="mt-3 grid grid-cols-3 gap-3">
			{#each products as p (p.id)}
				<li>
					<a href={`/product/${p.id}`} class="block group">
						{#if p.image}
							<img
								src={p.image}
								alt={p.imageAlt ?? p.name}
								class="aspect-square w-full rounded-sm object-cover transition-opacity group-hover:opacity-85"
								loading="lazy"
							/>
						{:else}
							<div class="aspect-square w-full rounded-sm bg-surface-muted"></div>
						{/if}
						<div class="mt-2 line-clamp-2 text-xs">{p.name}</div>
						<div class="text-xs font-medium">{fmt(p.price)}</div>
					</a>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<script lang="ts">
	import { getBrand } from '$lib/brand/config';

	let {
		price,
		listPrice,
		size = 'md',
		showSavings = true,
		comparableLabel,
	}: {
		price: number;
		listPrice?: number | null;
		size?: 'sm' | 'md' | 'lg';
		showSavings?: boolean;
		/** Override the off-price comparable label. Default: brand.pricingStyle drives. */
		comparableLabel?: string;
	} = $props();

	const brand = getBrand();
	const isOffPrice = $derived(brand.pricingStyle === 'off-price');
	const isOnSale = $derived(typeof listPrice === 'number' && listPrice > price);
	const savingsPct = $derived(
		isOnSale && listPrice ? Math.round(((listPrice - price) / listPrice) * 100) : 0
	);

	const fmt = (n: number) =>
		`$${n.toLocaleString(undefined, {
			minimumFractionDigits: n % 1 ? 2 : 0,
			maximumFractionDigits: 2,
		})}`;

	const priceClass = $derived(
		size === 'lg' ? 'text-2xl font-semibold' : size === 'sm' ? 'text-sm font-medium' : 'text-base font-medium'
	);
	const subClass = $derived(size === 'sm' ? 'text-[0.6875rem]' : 'text-xs');

	const compareCopy = $derived(
		comparableLabel ?? (isOffPrice ? 'Comparable value' : 'Was')
	);
</script>

<div class="inline-flex flex-col gap-0.5">
	{#if isOnSale && listPrice}
		<div class="flex items-baseline gap-2">
			<span class="{priceClass} text-primary">{fmt(price)}</span>
			<span class="{subClass} text-surface-muted-fg line-through">{fmt(listPrice)}</span>
		</div>
		<div class="{subClass} flex items-center gap-2 text-surface-muted-fg">
			<span>{compareCopy} {fmt(listPrice)}</span>
			{#if showSavings && savingsPct > 0}
				<span class="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-primary">
					Save {savingsPct}%
				</span>
			{/if}
		</div>
	{:else}
		<span class="{priceClass} text-surface-fg">{fmt(price)}</span>
	{/if}
</div>

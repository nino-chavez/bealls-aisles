<script lang="ts">
	let {
		mode,
		amount,
		unit,
		threshold,
		tierLabel = '',
	}: {
		mode: 'earn' | 'redeem' | 'tier-progress';
		amount: number;
		unit: string;
		threshold?: number;
		tierLabel?: string;
	} = $props();

	const message = $derived.by(() => {
		if (mode === 'earn' && threshold) {
			return {
				eyebrow: 'Earn rewards',
				main: `Earn $${amount} ${unit}`,
				sub: `for every $${threshold} you spend`,
			};
		}
		if (mode === 'redeem') {
			return {
				eyebrow: 'You have rewards',
				main: `${amount} ${unit} ready`,
				sub: 'Apply at checkout',
			};
		}
		if (mode === 'tier-progress' && threshold) {
			return {
				eyebrow: 'Tier progress',
				main: `${amount} ${unit} from ${tierLabel || 'next tier'}`,
				sub: `${threshold} total to unlock`,
			};
		}
		return { eyebrow: 'Rewards', main: `${amount} ${unit}`, sub: '' };
	});
</script>

<div class="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-sm border border-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 px-6 py-5">
	<div class="flex flex-1 items-center gap-5">
		<div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="9"/>
				<path d="M12 7v10M9 10h6M9 14h6"/>
			</svg>
		</div>

		<div class="flex flex-col">
			<span class="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
				{message.eyebrow}
			</span>
			<p class="font-display text-lg font-semibold text-surface-fg sm:text-xl">
				{message.main}
			</p>
			{#if message.sub}
				<p class="text-xs text-surface-muted-fg">{message.sub}</p>
			{/if}
		</div>
	</div>

	<a
		href="/account/rewards"
		class="inline-flex items-center justify-center rounded-sm border border-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary transition-colors hover:bg-primary hover:text-white"
	>
		{mode === 'redeem' ? 'Apply' : 'Learn More'}
	</a>
</div>

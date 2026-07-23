<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let {
		eyebrow = '',
		headline,
		body = '',
		endsAt,
		ctaLabel = '',
		ctaHref = '',
	}: {
		eyebrow?: string;
		headline: string;
		body?: string;
		endsAt: string;
		ctaLabel?: string;
		ctaHref?: string;
	} = $props();

	const target = $derived(new Date(endsAt).getTime());

	let now = $state(Date.now());
	let timer: ReturnType<typeof setInterval> | undefined;

	onMount(() => {
		now = Date.now();
		timer = setInterval(() => {
			now = Date.now();
		}, 1000);
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});

	const remaining = $derived(Math.max(0, target - now));
	const expired = $derived(remaining === 0);

	const days = $derived(Math.floor(remaining / 86_400_000));
	const hours = $derived(Math.floor((remaining % 86_400_000) / 3_600_000));
	const minutes = $derived(Math.floor((remaining % 3_600_000) / 60_000));
	const seconds = $derived(Math.floor((remaining % 60_000) / 1000));

	function pad(n: number) {
		return n.toString().padStart(2, '0');
	}
</script>

{#if !expired}
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-sm border border-primary/30 bg-primary/5 px-6 py-5">
		<div class="flex flex-1 flex-col gap-1">
			{#if eyebrow}
				<span class="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</span>
			{/if}
			<p class="font-display text-lg font-semibold leading-tight text-surface-fg sm:text-xl">{headline}</p>
			{#if body}
				<p class="text-xs text-surface-muted-fg sm:text-sm">{body}</p>
			{/if}
		</div>

		<div class="flex items-center gap-3">
			<div class="flex gap-2 font-mono text-surface-fg" aria-label="Time remaining">
				<div class="flex flex-col items-center">
					<span class="text-xl font-bold tabular-nums sm:text-2xl">{days}</span>
					<span class="text-[9px] uppercase tracking-wider text-surface-muted-fg">days</span>
				</div>
				<span class="text-xl font-bold sm:text-2xl">:</span>
				<div class="flex flex-col items-center">
					<span class="text-xl font-bold tabular-nums sm:text-2xl">{pad(hours)}</span>
					<span class="text-[9px] uppercase tracking-wider text-surface-muted-fg">hrs</span>
				</div>
				<span class="text-xl font-bold sm:text-2xl">:</span>
				<div class="flex flex-col items-center">
					<span class="text-xl font-bold tabular-nums sm:text-2xl">{pad(minutes)}</span>
					<span class="text-[9px] uppercase tracking-wider text-surface-muted-fg">min</span>
				</div>
				<span class="hidden text-xl font-bold sm:inline">:</span>
				<div class="hidden flex-col items-center sm:flex">
					<span class="text-xl font-bold tabular-nums sm:text-2xl">{pad(seconds)}</span>
					<span class="text-[9px] uppercase tracking-wider text-surface-muted-fg">sec</span>
				</div>
			</div>

			{#if ctaLabel}
				<a
					href={ctaHref || '#'}
					class="inline-flex items-center justify-center rounded-sm bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
				>
					{ctaLabel}
				</a>
			{/if}
		</div>
	</div>
{/if}

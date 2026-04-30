<script lang="ts">
	let {
		eyebrow,
		headline,
		body = '',
		code = '',
		ctaLabel,
	}: {
		eyebrow: string;
		headline: string;
		body?: string;
		code?: string;
		ctaLabel: string;
	} = $props();

	let revealed = $state(false);

	function reveal(e: MouseEvent) {
		e.preventDefault();
		revealed = true;
		if (code && navigator.clipboard) {
			navigator.clipboard.writeText(code).catch(() => {});
		}
	}
</script>

<div class="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-sm border-l-4 border-primary bg-warning/15 px-6 py-4">
	<div class="flex flex-1 items-center gap-4">
		<span class="hidden flex-shrink-0 text-3xl font-display font-bold uppercase italic text-surface-fg sm:block">
			{eyebrow.split(' ').slice(0, 1).join(' ')}<br><span class="text-base normal-case font-medium">{eyebrow.split(' ').slice(1).join(' ')}</span>
		</span>

		<div class="flex flex-1 flex-col gap-0.5">
			<span class="text-[10px] font-semibold uppercase tracking-[0.18em] text-surface-muted-fg sm:hidden">
				{eyebrow}
			</span>
			<p class="text-base font-semibold leading-snug text-surface-fg sm:text-lg">
				{headline}
			</p>
			{#if body}
				<p class="text-xs text-surface-muted-fg">{body}</p>
			{/if}
		</div>
	</div>

	{#if revealed && code}
		<div class="inline-flex items-center gap-2 rounded-sm bg-surface-fg px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider text-surface-bg">
			<span>{code}</span>
			<span class="text-[10px] uppercase tracking-wider opacity-70">Copied</span>
		</div>
	{:else}
		<button
			onclick={reveal}
			class="inline-flex items-center justify-center rounded-sm bg-primary px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
		>
			{ctaLabel}
		</button>
	{/if}
</div>

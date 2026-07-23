<script lang="ts">
	let {
		storeName,
		distanceMi,
		readyByLabel,
		productName = '',
		ctaLabel = 'Check availability',
		ctaHref = '/store-locator',
	}: {
		storeName: string;
		distanceMi: number;
		readyByLabel: string;
		productName?: string;
		ctaLabel?: string;
		ctaHref?: string;
	} = $props();
</script>

<div
	class="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-success/30 bg-success/5 px-4 py-3 text-sm"
	role="region"
	aria-label="In-store pickup availability"
>
	<div class="flex items-center gap-3">
		<span class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success" aria-hidden="true">
			<svg viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
				<path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2.5l1 .5v9a1 1 0 01-1 1H2a1 1 0 01-1-1V7l1-.5V4a1 1 0 011-1zm1 1v1.5h12V5H4z" />
				<path d="M6 9h2v3H6zM12 9h2v3h-2z" />
			</svg>
		</span>
		<div>
			<p class="font-medium text-surface-fg">
				Free pickup at {storeName}
				<span class="text-surface-muted-fg">· {distanceMi.toFixed(1)} mi</span>
			</p>
			<p class="text-xs text-surface-muted-fg">
				{readyByLabel}{productName ? ` for ${productName}` : ''}
			</p>
		</div>
	</div>
	<a
		href={ctaHref}
		class="text-xs font-medium text-primary hover:underline"
	>
		{ctaLabel} →
	</a>
</div>

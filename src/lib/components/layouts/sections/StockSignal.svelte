<script lang="ts">
	let {
		level,
		message,
		urgency,
	}: {
		level: 'plentiful' | 'low' | 'last-few' | 'out';
		message: string;
		urgency: 'none' | 'soft' | 'hard';
	} = $props();

	let toneClass = $derived.by(() => {
		if (level === 'out') return 'border-error/50 bg-error/5 text-error';
		if (urgency === 'hard') return 'border-primary/50 bg-primary/10 text-primary';
		if (urgency === 'soft') return 'border-warning/50 bg-warning/10 text-warning';
		return 'border-surface-border bg-surface-muted text-surface-muted-fg';
	});

	let dotClass = $derived.by(() => {
		if (level === 'out') return 'bg-error';
		if (level === 'last-few') return 'bg-primary';
		if (level === 'low') return 'bg-warning';
		return 'bg-success';
	});
</script>

<div class="inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-xs font-medium {toneClass}">
	<span class="h-2 w-2 rounded-full {dotClass}" aria-hidden="true"></span>
	<span>{message}</span>
</div>

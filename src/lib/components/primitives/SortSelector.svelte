<script lang="ts">
	type SortOption = { value: string; label: string };

	let {
		options,
		value = $bindable(),
		ariaLabel = 'Sort products',
		onchange,
	}: {
		options: SortOption[];
		value?: string;
		ariaLabel?: string;
		onchange?: (next: string) => void;
	} = $props();

	function handleChange(e: Event) {
		const next = (e.currentTarget as HTMLSelectElement).value;
		value = next;
		onchange?.(next);
	}
</script>

<label class="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-surface-muted-fg">
	<span>Sort</span>
	<span class="relative">
		<select
			class="h-9 appearance-none rounded-sm border border-surface-border bg-surface-card pl-3 pr-8 text-[0.8125rem] font-medium normal-case tracking-normal text-surface-fg transition-colors hover:border-neutral-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
			aria-label={ariaLabel}
			{value}
			onchange={handleChange}
		>
			{#each options as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
		<svg
			class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
			xmlns="http://www.w3.org/2000/svg"
			width="12"
			height="12"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="m6 9 6 6 6-6" />
		</svg>
	</span>
</label>

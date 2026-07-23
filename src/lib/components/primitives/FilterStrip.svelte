<script lang="ts">
	import Chip from './Chip.svelte';

	type FilterValue = string;
	type Filter = {
		id: string;
		label: string;
		value: FilterValue;
	};

	let {
		filters = [],
		resultCount,
		onclear,
		onremove,
	}: {
		filters?: Filter[];
		resultCount?: number;
		onclear?: () => void;
		onremove?: (filter: Filter) => void;
	} = $props();

	const hasFilters = $derived(filters.length > 0);
</script>

<div class="flex flex-wrap items-center gap-2 border-b border-surface-border pb-4">
	{#if typeof resultCount === 'number'}
		<span class="text-xs font-medium uppercase tracking-wider text-surface-muted-fg">
			{resultCount.toLocaleString()} {resultCount === 1 ? 'result' : 'results'}
		</span>
	{/if}

	{#if hasFilters}
		<span class="mx-2 h-4 w-px bg-surface-border" aria-hidden="true"></span>

		{#each filters as filter}
			<Chip
				label={filter.label}
				removable
				onremove={() => onremove?.(filter)}
				size="sm"
				variant="active"
			/>
		{/each}

		<button
			type="button"
			onclick={onclear}
			class="ml-1 text-xs font-medium uppercase tracking-wider text-surface-muted-fg underline-offset-4 transition-colors hover:text-primary hover:underline"
		>
			Clear all
		</button>
	{/if}
</div>

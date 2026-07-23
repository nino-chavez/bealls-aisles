<script lang="ts">
	type Tab = { label: string; content: string };

	let {
		tabs,
		initialIndex = 0,
	}: {
		tabs: Tab[];
		initialIndex?: number;
	} = $props();

	let activeIndex = $state(Math.min(Math.max(initialIndex, 0), Math.max(tabs.length - 1, 0)));
	let active = $derived(tabs[activeIndex]);
</script>

{#if tabs.length > 0}
	<section class="border-t border-surface-border pt-8" aria-label="Product details">
		<div role="tablist" class="flex flex-wrap gap-1 border-b border-surface-border">
			{#each tabs as tab, idx}
				<button
					type="button"
					role="tab"
					id="desc-tab-{idx}"
					aria-selected={idx === activeIndex}
					aria-controls="desc-panel-{idx}"
					tabindex={idx === activeIndex ? 0 : -1}
					onclick={() => (activeIndex = idx)}
					class="-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors
						{idx === activeIndex
							? 'border-primary text-surface-fg'
							: 'border-transparent text-surface-muted-fg hover:text-surface-fg'}"
				>
					{tab.label}
				</button>
			{/each}
		</div>

		{#each tabs as tab, idx}
			<div
				role="tabpanel"
				id="desc-panel-{idx}"
				aria-labelledby="desc-tab-{idx}"
				hidden={idx !== activeIndex}
				class="prose prose-sm mt-6 max-w-none leading-relaxed text-surface-muted-fg"
			>
				{#if idx === activeIndex}
					{@html active.content}
				{/if}
			</div>
		{/each}
	</section>
{/if}

<script lang="ts">
	type VariantOption = { id: string; label: string; available: boolean; swatch?: string };
	type VariantGroup = { name: string; style: 'chip' | 'swatch' | 'dropdown'; options: VariantOption[] };

	let {
		groups,
		onchange,
	}: {
		groups: VariantGroup[];
		onchange?: (selection: Record<string, string>) => void;
	} = $props();

	let userSelection = $state<Record<string, string>>({});

	let selected = $derived.by((): Record<string, string> => {
		const out: Record<string, string> = {};
		for (const g of groups) {
			const fallback = g.options.find((o) => o.available)?.id;
			const chosen = userSelection[g.name] ?? fallback;
			if (chosen !== undefined) out[g.name] = chosen;
		}
		return out;
	});

	function pick(groupName: string, optionId: string) {
		userSelection = { ...userSelection, [groupName]: optionId };
		onchange?.(selected);
	}
</script>

{#if groups.length > 0}
	<div class="flex flex-col gap-5">
		{#each groups as group}
			<div>
				<div class="flex items-baseline justify-between">
					<p class="text-sm font-medium">{group.name}</p>
					{#if selected[group.name]}
						<p class="text-sm text-surface-muted-fg">
							{group.options.find((o) => o.id === selected[group.name])?.label}
						</p>
					{/if}
				</div>

				{#if group.style === 'dropdown'}
					<select
						class="mt-2 w-full rounded-sm border border-surface-border bg-surface-card px-3 py-2 text-sm"
						value={selected[group.name]}
						onchange={(e) => pick(group.name, (e.currentTarget as HTMLSelectElement).value)}
					>
						{#each group.options as opt}
							<option value={opt.id} disabled={!opt.available}>
								{opt.label}{!opt.available ? ' (out of stock)' : ''}
							</option>
						{/each}
					</select>
				{:else}
					<div class="mt-2 flex flex-wrap gap-2">
						{#each group.options as opt}
							{@const isSelected = selected[group.name] === opt.id}
							<button
								type="button"
								disabled={!opt.available}
								onclick={() => pick(group.name, opt.id)}
								aria-pressed={isSelected}
								class="rounded-sm border px-3 py-1.5 text-sm transition-colors
									{group.style === 'swatch' ? 'h-9 w-9 p-0' : ''}
									{isSelected
										? 'border-primary bg-primary text-white'
										: opt.available
											? 'border-surface-border hover:border-primary'
											: 'cursor-not-allowed border-surface-border text-surface-muted-fg line-through'}"
								style={group.style === 'swatch' && opt.swatch ? `background-color: ${opt.swatch}` : ''}
								title={opt.label}
							>
								{group.style === 'swatch' ? '' : opt.label}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}

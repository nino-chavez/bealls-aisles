<script lang="ts">
	let {
		title,
		subtitle = '',
		showSort = false,
		showFilter = false,
		heroImage = '',
		subcategories = [],
	}: {
		title: string;
		subtitle?: string;
		showSort?: boolean;
		showFilter?: boolean;
		heroImage?: string;
		subcategories?: Array<{ label: string; href: string }>;
	} = $props();
</script>

{#if heroImage}
	<div class="relative mb-6 aspect-[5/1] w-full overflow-hidden rounded-sm bg-surface-muted">
		<img
			src={heroImage}
			alt={title}
			class="h-full w-full object-cover"
			loading="lazy"
		/>
		<div class="absolute inset-0 flex items-center justify-center">
			<h1 class="text-3xl font-display tracking-tight text-white drop-shadow-md">{title}</h1>
		</div>
	</div>
{/if}

<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div>
		{#if !heroImage}
			<h1 class="text-2xl">{title}</h1>
		{/if}
		{#if subtitle}
			<p class="mt-1 text-sm text-surface-muted-fg">{subtitle}</p>
		{/if}
	</div>
	{#if showFilter || showSort}
		<div class="flex gap-2">
			{#if showFilter}
				<button class="rounded-sm border border-surface-border px-3 py-1.5 text-xs font-medium text-surface-muted-fg transition-colors hover:border-neutral-400 hover:text-surface-fg">
					Filter
				</button>
			{/if}
			{#if showSort}
				<select class="rounded-sm border border-surface-border bg-surface-card px-3 py-1.5 text-xs font-medium text-surface-muted-fg">
					<option>Price: Low to High</option>
					<option>Price: High to Low</option>
					<option>Newest</option>
				</select>
			{/if}
		</div>
	{/if}
</div>

{#if subcategories && subcategories.length > 0}
	<div class="mb-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-surface-border pb-4 text-xs uppercase tracking-wider">
		{#each subcategories as sub}
			<a
				href={sub.href}
				class="text-surface-muted-fg transition-colors hover:text-primary"
			>
				{sub.label}
			</a>
		{/each}
	</div>
{/if}

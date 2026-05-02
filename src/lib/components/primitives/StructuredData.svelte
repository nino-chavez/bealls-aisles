<script lang="ts">
	let { data }: { data: Record<string, unknown> | Array<Record<string, unknown>> } = $props();
	const json = $derived(JSON.stringify(data));
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${json.replace(/</g, '\\u003c')}</script>`}
</svelte:head>

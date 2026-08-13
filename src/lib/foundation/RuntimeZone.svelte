<script lang="ts">
	import ZoneRenderer from './ZoneRenderer.svelte';
	import type { ZoneResolution } from './resolve-zone';
	import type { Product } from '$lib/types';

	let {
		execution,
		zoneId,
		products = [],
	}: {
		execution: { decisions: readonly { zoneId: string; terminal: string; resolution: ZoneResolution }[] };
		zoneId: string;
		products?: Product[];
	} = $props();

	let decision = $derived(execution.decisions.find((candidate) => candidate.zoneId === zoneId));
</script>

{#if decision && decision.resolution.content !== null}
	<div
		data-runtime-zone={decision.zoneId}
		data-zone-terminal={decision.terminal}
		data-zone-source={decision.resolution.source}
	>
		<ZoneRenderer resolution={decision.resolution} {products} />
	</div>
{/if}

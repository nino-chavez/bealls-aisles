<script lang="ts">
	import type { Snippet } from 'svelte';
	import { runtimeZoneDomAttributes, type RuntimeZoneEnvelopeView } from './runtime-zone-envelope';

	let {
		view,
		className = '',
		children,
	}: {
		view: RuntimeZoneEnvelopeView;
		className?: string;
		children: Snippet;
	} = $props();

	let attributes = $derived(runtimeZoneDomAttributes(view));
</script>

<div class={className} {...attributes}>
	{@render children()}
</div>

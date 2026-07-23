<script lang="ts">
	/**
	 * AILoadingInline — compact "AI is composing this" state for sub-page zones.
	 *
	 * Companion to LayoutBuildingState (full-surface). Same aesthetic — three
	 * pulsing dots + eyebrow + label + progress bar — sized for inline contexts
	 * like the cart drawer upsell row, PDP "pairs well with", picks tray
	 * suggestions, and checkout assurance + upsell sections.
	 *
	 * The point is to make the AI-composition latency *legible*: every inline
	 * zone the engine fills should communicate "AI is working" in the same
	 * vocabulary as the full-surface loader, so cold-start latency reads as
	 * intent rather than as a slow site.
	 */

	let {
		label = 'Composing personalized recommendations',
		estimatedMs = 8000,
		size = 'medium',
	}: {
		label?: string;
		estimatedMs?: number;
		size?: 'small' | 'medium';
	} = $props();

	let elapsedMs = $state(0);

	$effect(() => {
		const startedAt = Date.now();
		const tick = setInterval(() => {
			elapsedMs = Date.now() - startedAt;
		}, 100);
		return () => clearInterval(tick);
	});

	let progressPct = $derived(Math.min(95, Math.round((elapsedMs / estimatedMs) * 100)));
	let isCompact = $derived(size === 'small');
</script>

<section
	class="rounded-sm border border-surface-border bg-gradient-to-br from-surface-muted via-surface-bg to-surface-muted {isCompact ? 'px-4 py-4' : 'px-5 py-5'}"
	aria-live="polite"
	aria-busy="true"
>
	<div class="flex items-center gap-3">
		<div class="flex shrink-0 items-center gap-1" aria-hidden="true">
			<span class="dot dot-1 inline-block {isCompact ? 'h-1 w-1' : 'h-1.5 w-1.5'} rounded-full bg-primary"></span>
			<span class="dot dot-2 inline-block {isCompact ? 'h-1 w-1' : 'h-1.5 w-1.5'} rounded-full bg-primary"></span>
			<span class="dot dot-3 inline-block {isCompact ? 'h-1 w-1' : 'h-1.5 w-1.5'} rounded-full bg-primary"></span>
		</div>
		<div class="min-w-0 flex-1">
			<p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
				AI Personalization
			</p>
			<p class="mt-0.5 truncate {isCompact ? 'text-xs' : 'text-sm'} font-medium text-surface-fg">
				{label}…
			</p>
		</div>
	</div>
	<div class="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-border">
		<div
			class="h-full rounded-full bg-primary transition-all duration-200 ease-out"
			style="width: {progressPct}%"
		></div>
	</div>
</section>

<style>
	.dot {
		animation: pulse-dot 1.4s ease-in-out infinite;
	}
	.dot-2 { animation-delay: 0.2s; }
	.dot-3 { animation-delay: 0.4s; }

	@keyframes pulse-dot {
		0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
		40% { opacity: 1; transform: scale(1.15); }
	}
</style>

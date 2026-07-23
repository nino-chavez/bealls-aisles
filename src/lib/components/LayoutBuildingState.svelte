<script lang="ts">
	let {
		persona = 'gatherer',
		surface = 'homepage',
		categoryName = '',
	}: {
		persona?: string;
		surface?: 'homepage' | 'category' | 'cart' | 'empty' | 'rescue';
		categoryName?: string;
	} = $props();

	const PERSONA_LABEL: Record<string, string> = {
		gatherer: 'a discovery-driven shopper',
		hunter: 'a deal-driven shopper',
		researcher: 'a detail-driven shopper',
		gifter: 'a gift-driven shopper',
	};

	const STATUSES = [
		'Reading your signals',
		'Selecting products that match you',
		'Composing your layout',
		'Almost ready',
	];

	let stepIndex = $state(0);
	let elapsedMs = $state(0);

	$effect(() => {
		const startedAt = Date.now();
		const stepInterval = setInterval(() => {
			stepIndex = Math.min(stepIndex + 1, STATUSES.length - 1);
		}, 2000);
		const tick = setInterval(() => {
			elapsedMs = Date.now() - startedAt;
		}, 100);
		return () => {
			clearInterval(stepInterval);
			clearInterval(tick);
		};
	});

	// Estimated 8s budget; cap progress at 95% so it never looks "done"
	const ESTIMATED_MS = 8000;
	let progressPct = $derived(Math.min(95, Math.round((elapsedMs / ESTIMATED_MS) * 100)));
	let surfaceLabel = $derived(
		surface === 'category' && categoryName
			? categoryName
			: surface === 'homepage'
				? 'homepage'
				: surface === 'cart'
					? 'cart recommendations'
					: surface === 'empty' || surface === 'rescue'
						? 'next steps'
						: 'page'
	);
	let personaLabel = $derived(PERSONA_LABEL[persona] ?? PERSONA_LABEL.gatherer);
</script>

<section
	class="relative overflow-hidden border-y border-surface-border bg-gradient-to-br from-surface-muted via-surface-bg to-surface-muted"
	aria-live="polite"
	aria-busy="true"
>
	<div class="mx-auto flex max-w-3xl flex-col items-center px-6 py-14 text-center sm:py-16">
		<!-- AI sparkle indicator -->
		<div class="mb-5 flex items-center gap-2">
			<span class="dot dot-1 inline-block h-2 w-2 rounded-full bg-primary"></span>
			<span class="dot dot-2 inline-block h-2 w-2 rounded-full bg-primary"></span>
			<span class="dot dot-3 inline-block h-2 w-2 rounded-full bg-primary"></span>
		</div>

		<p class="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
			AI Personalization in progress
		</p>
		<h2 class="font-display text-2xl leading-tight tracking-tight text-surface-fg sm:text-3xl">
			Building your {surfaceLabel} for {personaLabel}
		</h2>
		<p class="mt-3 max-w-md text-sm leading-relaxed text-surface-muted-fg">
			An AI agent is composing this view in real time — selecting products, ordering sections, and writing copy that matches your shopping signals. This usually takes 5&ndash;10 seconds.
		</p>

		<!-- Rotating status -->
		<div class="mt-7 flex h-6 items-center justify-center" aria-live="polite">
			{#key stepIndex}
				<p class="status-line text-sm font-medium text-surface-fg">
					{STATUSES[stepIndex]}<span class="ellipsis">...</span>
				</p>
			{/key}
		</div>

		<!-- Progress bar -->
		<div class="mt-5 h-1 w-full max-w-sm overflow-hidden rounded-full bg-surface-border">
			<div
				class="h-full rounded-full bg-primary transition-all duration-200 ease-out"
				style="width: {progressPct}%"
			></div>
		</div>
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

	.status-line {
		animation: fade-in 0.3s ease-out;
	}

	@keyframes fade-in {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.ellipsis {
		display: inline-block;
		animation: ellipsis-pulse 1.2s ease-in-out infinite;
	}

	@keyframes ellipsis-pulse {
		0%, 100% { opacity: 0.4; }
		50% { opacity: 1; }
	}
</style>

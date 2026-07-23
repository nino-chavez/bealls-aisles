<script lang="ts">
	let {
		eyebrow = '',
		headline,
		body = '',
		offerCopy = '',
		ctaLabel,
		privacyNote = '',
	}: {
		eyebrow?: string;
		headline: string;
		body?: string;
		offerCopy?: string;
		ctaLabel: string;
		privacyNote?: string;
	} = $props();

	let email = $state('');
	let submitting = $state(false);
	let submitted = $state(false);
	let errorMessage = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!email || submitting) return;
		submitting = true;
		errorMessage = '';
		try {
			const res = await fetch('/api/email-signup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, source: 'email-capture-inline' }),
			});
			if (!res.ok) throw new Error('Signup failed');
			submitted = true;
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Signup failed';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="mb-10 rounded-sm border border-surface-muted bg-surface-muted/40 px-6 py-8 sm:px-10 sm:py-10">
	<div class="mx-auto flex max-w-2xl flex-col gap-4 text-center">
		{#if eyebrow}
			<span class="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">{eyebrow}</span>
		{/if}
		<h3 class="font-display text-2xl font-semibold leading-tight text-surface-fg sm:text-3xl">{headline}</h3>
		{#if body}
			<p class="text-sm leading-relaxed text-surface-muted-fg">{body}</p>
		{/if}

		{#if !submitted}
			<form onsubmit={submit} class="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-2">
				<input
					type="email"
					required
					bind:value={email}
					placeholder="you@example.com"
					class="flex-1 rounded-sm border border-surface-muted bg-surface-bg px-4 py-3 text-sm text-surface-fg placeholder:text-surface-muted-fg focus:border-primary focus:outline-none"
					aria-label="Email address"
				/>
				<button
					type="submit"
					disabled={submitting}
					class="inline-flex items-center justify-center rounded-sm bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-50"
				>
					{submitting ? 'Signing up…' : ctaLabel}
				</button>
			</form>
			{#if errorMessage}
				<p class="text-xs text-error" role="alert">{errorMessage}</p>
			{/if}
		{:else}
			<div class="mt-2 rounded-sm border border-success/40 bg-success/10 px-4 py-4 text-sm text-surface-fg">
				<p class="font-semibold">Thanks for signing up.</p>
				{#if offerCopy}
					<p class="mt-1 text-surface-muted-fg">{offerCopy}</p>
				{/if}
			</div>
		{/if}

		{#if privacyNote}
			<p class="text-[11px] leading-relaxed text-surface-muted-fg">{privacyNote}</p>
		{/if}
	</div>
</div>

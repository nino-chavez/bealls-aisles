<script lang="ts">
	/**
	 * PromoCodeEntry — coupon input + applied-codes list.
	 *
	 * Layer: foundation. Code application is a stub for the prototype —
	 * BC promo codes are applied at the BC Optimized Checkout step. This
	 * block lets shoppers paste/enter codes pre-checkout for visibility,
	 * but the actual discount evaluates at BC handoff.
	 */
	export interface AppliedCode {
		code: string;
		label: string;
		value: number;
	}

	let {
		appliedCodes = [],
	}: {
		appliedCodes?: AppliedCode[];
	} = $props();

	let value = $state('');
	// Initialize from the snapshot of `appliedCodes` at mount; subsequent
	// mutations are local to this block (codes are honored at BC handoff).
	let codes = $state<AppliedCode[]>([...appliedCodes]);
	let message = $state('');

	function apply() {
		const code = value.trim().toUpperCase();
		if (!code) return;
		if (codes.some((c) => c.code === code)) {
			message = 'Code already applied';
			return;
		}
		// Stub — the actual discount is evaluated at BC checkout. We capture
		// the code locally for visibility; merchant logic on BC handoff
		// honors any valid code.
		codes = [...codes, { code, label: 'Applied at checkout', value: 0 }];
		value = '';
		message = `${code} will be applied at checkout`;
	}

	function remove(code: string) {
		codes = codes.filter((c) => c.code !== code);
		message = '';
	}
</script>

<div class="space-y-2">
	<label class="block text-xs font-semibold uppercase tracking-wider text-surface-muted-fg" for="promo-code-input">
		Promo code
	</label>
	<div class="flex gap-2">
		<input
			id="promo-code-input"
			type="text"
			bind:value
			onkeydown={(e) => e.key === 'Enter' && apply()}
			placeholder="Enter code"
			class="flex-1 rounded-sm border border-surface-border bg-surface-bg px-3 py-2 text-sm focus:border-primary focus:outline-none"
		/>
		<button
			type="button"
			onclick={apply}
			disabled={!value.trim()}
			class="rounded-sm border border-surface-border bg-surface-bg px-4 py-2 text-sm font-medium hover:bg-surface-muted disabled:opacity-40"
		>
			Apply
		</button>
	</div>
	{#if message}
		<p class="text-xs text-surface-muted-fg" aria-live="polite">{message}</p>
	{/if}
	{#if codes.length > 0}
		<ul class="space-y-1 pt-1">
			{#each codes as c (c.code)}
				<li class="flex items-center justify-between rounded-sm bg-surface-muted px-3 py-2 text-xs">
					<span class="font-medium">{c.code}</span>
					<span class="text-surface-muted-fg">{c.label}</span>
					<button
						type="button"
						onclick={() => remove(c.code)}
						class="text-surface-muted-fg hover:text-error"
						aria-label={`Remove ${c.code}`}
					>
						×
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

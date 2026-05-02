<script lang="ts" module>
	type ToastEntry = {
		id: number;
		message: string;
		variant: 'success' | 'error' | 'info';
		href?: string;
		hrefLabel?: string;
	};

	let counter = 0;
	let toasts = $state<ToastEntry[]>([]);

	export function showToast(opts: {
		message: string;
		variant?: 'success' | 'error' | 'info';
		href?: string;
		hrefLabel?: string;
		durationMs?: number;
	}) {
		const id = ++counter;
		const entry: ToastEntry = {
			id,
			message: opts.message,
			variant: opts.variant ?? 'success',
			href: opts.href,
			hrefLabel: opts.hrefLabel,
		};
		toasts = [...toasts, entry];
		const ttl = opts.durationMs ?? 4000;
		setTimeout(() => {
			toasts = toasts.filter((t) => t.id !== id);
		}, ttl);
	}

	export function dismissToast(id: number) {
		toasts = toasts.filter((t) => t.id !== id);
	}
</script>

<script lang="ts">
	const variantClass = (v: 'success' | 'error' | 'info') =>
		({
			success: 'border-success/30 bg-success/5 text-success',
			error: 'border-error/30 bg-error/5 text-error',
			info: 'border-surface-border bg-surface-card text-surface-fg',
		}[v]);
</script>

{#if toasts.length > 0}
	<div
		class="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2"
		role="status"
		aria-live="polite"
		aria-atomic="false"
	>
		{#each toasts as t (t.id)}
			<div
				class="pointer-events-auto flex items-center gap-3 rounded-md border bg-surface-card px-4 py-3 text-sm shadow-md {variantClass(t.variant)}"
			>
				<span class="font-medium">{t.message}</span>
				{#if t.href && t.hrefLabel}
					<a
						href={t.href}
						class="font-semibold uppercase tracking-wider underline-offset-4 hover:underline"
					>
						{t.hrefLabel}
					</a>
				{/if}
				<button
					type="button"
					onclick={() => dismissToast(t.id)}
					class="text-surface-muted-fg transition-opacity hover:opacity-70"
					aria-label="Dismiss"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				</button>
			</div>
		{/each}
	</div>
{/if}

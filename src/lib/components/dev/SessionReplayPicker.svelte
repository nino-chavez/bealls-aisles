<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import {
		loadSessions,
		listSessions,
		getLoadError,
		startReplay,
		stopReplay,
		getReplayStatus,
	} from '$lib/dev/session-replay.svelte';

	let selected = $state<string>('');
	let tick = $state(0);

	onMount(() => {
		void loadSessions();
		// Poll every 250ms so the next-event countdown ticks live.
		const id = setInterval(() => {
			untrack(() => {
				tick++;
			});
		}, 250);
		return () => clearInterval(id);
	});

	const sessions = $derived.by(() => {
		void tick;
		return listSessions();
	});
	const status = $derived.by(() => {
		void tick;
		return getReplayStatus();
	});
	const error = $derived.by(() => {
		void tick;
		return getLoadError();
	});

	function fmt(seconds: number | null): string {
		if (seconds == null) return '—';
		if (seconds < 1) return 'now';
		return `${seconds.toFixed(1)}s`;
	}
</script>

<div class="replay">
	<details>
		<summary>▸ Session replay <span class="hint">— anonymized real shopper journeys</span></summary>

		{#if error}
			<div class="err">Failed to load fixtures: {error}</div>
		{:else if sessions.length === 0}
			<div class="hint">Loading fixtures…</div>
		{:else}
			<div class="picker">
				<select bind:value={selected} disabled={!!status}>
					<option value="">Pick a session…</option>
					{#each sessions as s (s.id)}
						<option value={s.id}>
							{s.label} ({s.events.length} ev, GT:{s.groundTruthPersona})
						</option>
					{/each}
				</select>

				{#if status}
					<button type="button" class="stop" onclick={stopReplay}>⏹ Stop</button>
				{:else}
					<button
						type="button"
						class="play"
						onclick={() => selected && startReplay(selected)}
						disabled={!selected}
					>
						▶ Replay
					</button>
				{/if}
			</div>

			{#if status}
				<div class="narrative">{status.narrative}</div>
				<div class="status">
					<span class="status-line">
						Playing <strong>{status.label}</strong>
						· ground truth: <span class="gt">{status.groundTruthPersona}</span>
					</span>
					<div class="bar">
						<div class="fill" style="width:{Math.round(status.progress * 100)}%"></div>
					</div>
					<span class="status-line">
						{status.firedCount}/{status.totalCount}
						{#if status.lastFired}
							· last: <code>{status.lastFired.type}</code>
							{#if status.lastFired.productLabel}
								<span class="product">{status.lastFired.productLabel}</span>
							{:else if status.lastFired.query}
								<span class="product">"{status.lastFired.query}"</span>
							{:else if status.lastFired.category}
								<span class="product">/{status.lastFired.category}</span>
							{/if}
						{/if}
						{#if status.nextEvent}
							· next: <code>{status.nextEvent.type}</code> in {fmt(status.nextInSeconds)}
						{:else}
							· complete
						{/if}
					</span>
				</div>
			{/if}
		{/if}
	</details>
</div>

<style>
	.replay {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid #27272a;
	}
	summary {
		cursor: pointer;
		font-size: 0.75rem;
		color: #d4d4d8;
		font-weight: 500;
	}
	.hint {
		color: #71717a;
		font-weight: 400;
	}
	.err {
		color: #f87171;
		font-size: 0.75rem;
		margin-top: 0.5rem;
	}
	.picker {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	select {
		flex: 1;
		min-width: 0;
		font-size: 0.75rem;
		background: #18181b;
		color: #f4f4f5;
		border: 1px solid #3f3f46;
		border-radius: 4px;
		padding: 0.25rem 0.5rem;
	}
	button {
		font-size: 0.75rem;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		border: 1px solid #3f3f46;
		background: #27272a;
		color: #f4f4f5;
	}
	button.play {
		background: rgba(34, 197, 94, 0.18);
		border-color: rgba(34, 197, 94, 0.4);
		color: #86efac;
	}
	button.play:hover:not(:disabled) {
		background: rgba(34, 197, 94, 0.3);
	}
	button.stop {
		background: rgba(220, 38, 38, 0.18);
		border-color: rgba(220, 38, 38, 0.4);
		color: #fca5a5;
	}
	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.narrative {
		font-size: 0.75rem;
		color: #a1a1aa;
		font-style: italic;
		margin-top: 0.5rem;
		line-height: 1.4;
	}
	.status {
		margin-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.status-line {
		font-size: 0.7rem;
		color: #d4d4d8;
	}
	.status-line code {
		background: #27272a;
		padding: 1px 4px;
		border-radius: 3px;
		font-size: 0.65rem;
	}
	.gt {
		color: #fbbf24;
		font-weight: 600;
		text-transform: capitalize;
	}
	.product {
		color: #93c5fd;
	}
	.bar {
		height: 4px;
		background: #27272a;
		border-radius: 2px;
		overflow: hidden;
	}
	.fill {
		height: 100%;
		background: linear-gradient(90deg, #3b82f6, #8b5cf6);
		transition: width 0.25s ease;
	}
</style>

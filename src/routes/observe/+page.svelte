<script lang="ts">
	import type { SignalEvent, PersonaInference, SignalSource } from '$lib/signals/types';

	// ─── Types ─────────────────────────────────────────────────────
	interface GenerationLog {
		type: string;
		persona: string;
		categorySlug: string;
		cacheHit: boolean;
		generationMs: number;
		productCount: number | null;
		inputTokens: number | null;
		outputTokens: number | null;
		evalScore: number | null;
		promptVersion: string;
		createdAt: string;
	}

	interface SessionData {
		sessionId: string;
		events: SignalEvent[];
		inference: PersonaInference;
		eventCount: number;
		crossSession: {
			storedPersona: string | null;
			storedCategory: string | null;
			visitCount: number;
			currentCategory: string;
		};
	}

	// ─── State ─────────────────────────────────────────────────────
	const POLL_INTERVAL = 2000;
	const OBSERVE_KEY = 'aisles-observe';

	let sessionIds = $state<string[]>([]);
	let selectedSessionId = $state<string | null>(null);
	let sessionData = $state<SessionData | null>(null);
	let logs = $state<GenerationLog[]>([]);
	let watchLatest = $state(true);
	let enrichmentOpen = $state(false);
	let previousEventCount = $state(0);
	let shiftFlash = $state(false);
	let authorized = $state(false);
	let keyInput = $state('');

	// Auth check from URL param
	if (typeof window !== 'undefined') {
		const params = new URLSearchParams(window.location.search);
		if (params.get('key') === OBSERVE_KEY) {
			authorized = true;
		}
	}

	// ─── Source color mapping ──────────────────────────────────────
	const SOURCE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
		request: { bg: 'bg-slate-700', text: 'text-slate-300', label: 'REQ' },
		navigation: { bg: 'bg-blue-700', text: 'text-blue-300', label: 'NAV' },
		interaction: { bg: 'bg-amber-700', text: 'text-amber-300', label: 'INT' },
		commerce: { bg: 'bg-emerald-700', text: 'text-emerald-300', label: 'COM' },
		refinement: { bg: 'bg-purple-700', text: 'text-purple-300', label: 'REF' },
		external: { bg: 'bg-gray-700', text: 'text-gray-300', label: 'EXT' },
	};

	// ─── Persona colors ───────────────────────────────────────────
	const PERSONA_COLORS: Record<string, string> = {
		gatherer: 'bg-teal-500',
		hunter: 'bg-orange-500',
		researcher: 'bg-blue-500',
		gifter: 'bg-pink-500',
	};

	const PERSONA_TEXT_COLORS: Record<string, string> = {
		gatherer: 'text-teal-400',
		hunter: 'text-orange-400',
		researcher: 'text-blue-400',
		gifter: 'text-pink-400',
	};

	// ─── Polling ───────────────────────────────────────────────────
	$effect(() => {
		if (!authorized) return;

		const fetchSessions = async () => {
			try {
				const res = await fetch(`/api/observe/sessions?key=${OBSERVE_KEY}`);
				const data = await res.json();
				sessionIds = data.sessionIds || [];

				if (watchLatest && sessionIds.length > 0) {
					selectedSessionId = sessionIds[0];
				}
			} catch { /* ignore */ }
		};

		fetchSessions();
		const interval = setInterval(fetchSessions, POLL_INTERVAL);
		return () => clearInterval(interval);
	});

	$effect(() => {
		if (!authorized || !selectedSessionId) return;

		// Immediate fetch + poll
		const doFetch = async () => {
			try {
				const [sessionRes, logsRes] = await Promise.all([
					fetch(`/api/observe/session?id=${selectedSessionId}&key=${OBSERVE_KEY}`),
					fetch(`/api/observe/logs?limit=20&key=${OBSERVE_KEY}`),
				]);
				const newSession = await sessionRes.json();
				const newLogs = await logsRes.json();

				if (newSession.events) {
					// Detect shift flash
					if (
						newSession.inference?.shift?.detected &&
						sessionData?.inference?.shift?.detected !== true
					) {
						shiftFlash = true;
						setTimeout(() => (shiftFlash = false), 2000);
					}
					previousEventCount = sessionData?.eventCount ?? 0;
					sessionData = newSession;
				}
				logs = newLogs.logs || [];
			} catch { /* ignore */ }
		};

		doFetch();
		const interval = setInterval(doFetch, POLL_INTERVAL);
		return () => clearInterval(interval);
	});

	// ─── Derived ──────────────────────────────────────────────────
	let sortedEvents = $derived(
		sessionData?.events ? [...sessionData.events].reverse() : []
	);

	let newEventIds = $derived(
		sessionData?.events
			? new Set(sessionData.events.slice(previousEventCount).map((e) => e.id))
			: new Set<string>()
	);

	let latestLog = $derived(logs.length > 0 ? logs[0] : null);

	let cumulativeStats = $derived.by(() => {
		if (logs.length === 0) return { count: 0, cacheHitRate: 0, avgMs: 0, totalTokens: 0 };
		const count = logs.length;
		const cacheHits = logs.filter((l) => l.cacheHit).length;
		const totalMs = logs.reduce((sum, l) => sum + l.generationMs, 0);
		const totalTokens = logs.reduce(
			(sum, l) => sum + (l.inputTokens ?? 0) + (l.outputTokens ?? 0),
			0
		);
		return {
			count,
			cacheHitRate: Math.round((cacheHits / count) * 100),
			avgMs: Math.round(totalMs / count),
			totalTokens,
		};
	});

	// ─── Helpers ──────────────────────────────────────────────────
	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
	}

	function formatPercent(n: number): string {
		return `${Math.round(n * 100)}%`;
	}

	function truncateId(id: string): string {
		return id.length > 12 ? id.slice(0, 8) + '...' + id.slice(-4) : id;
	}

	function handleAuth() {
		if (keyInput === OBSERVE_KEY) {
			authorized = true;
		}
	}
</script>

<svelte:head>
	<title>Observe — Aisles Telemetry</title>
</svelte:head>

<style>
	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	:global(.animate-slide-in) {
		animation: slide-in 0.3s ease-out;
	}
</style>

{#if !authorized}
	<!-- Auth gate -->
	<div class="flex min-h-screen items-center justify-center bg-neutral-950">
		<div class="w-80 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
			<h1 class="mb-4 font-mono text-lg text-neutral-200">Observe</h1>
			<p class="mb-4 text-sm text-neutral-500">Enter the observe key to continue.</p>
			<input
				type="password"
				bind:value={keyInput}
				onkeydown={(e) => e.key === 'Enter' && handleAuth()}
				class="mb-3 w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-sm text-neutral-200 outline-none focus:border-neutral-500"
				placeholder="key"
			/>
			<button
				onclick={handleAuth}
				class="w-full rounded bg-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-600"
			>
				Enter
			</button>
		</div>
	</div>
{:else}
	<div class="min-h-screen bg-neutral-950 text-neutral-200">
		<!-- ─── Top Bar: Session Picker ───────────────────────────── -->
		<header class="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur">
			<div class="flex items-center gap-4 px-4 py-3">
				<div class="flex items-center gap-2">
					<span class="font-mono text-xs tracking-widest text-neutral-500 uppercase">Observe</span>
					<span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
				</div>

				<select
					bind:value={selectedSessionId}
					class="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 font-mono text-xs text-neutral-300 outline-none"
				>
					<option value={null}>Select session...</option>
					{#each sessionIds as id}
						<option value={id}>{truncateId(id)}</option>
					{/each}
				</select>

				<label class="flex items-center gap-2 text-xs text-neutral-500">
					<input
						type="checkbox"
						bind:checked={watchLatest}
						class="rounded border-neutral-700 bg-neutral-800"
					/>
					Watch latest
				</label>

				{#if sessionData?.crossSession}
					<div class="ml-auto flex items-center gap-4 font-mono text-xs text-neutral-500">
						<span>visits: {sessionData.crossSession.visitCount}</span>
						{#if sessionData.crossSession.storedPersona}
							<span>stored: <span class={PERSONA_TEXT_COLORS[sessionData.crossSession.storedPersona]}>{sessionData.crossSession.storedPersona}</span></span>
						{/if}
						{#if sessionData.crossSession.currentCategory}
							<span>category: {sessionData.crossSession.currentCategory}</span>
						{/if}
						<span>events: {sessionData.eventCount}</span>
					</div>
				{/if}
			</div>
		</header>

		{#if !selectedSessionId || !sessionData}
			<div class="flex h-[calc(100vh-52px)] items-center justify-center">
				<p class="font-mono text-sm text-neutral-600">
					{sessionIds.length === 0 ? 'No active sessions. Browse the storefront to create one.' : 'Select a session to observe.'}
				</p>
			</div>
		{:else}
			<!-- ─── Dashboard Grid ───────────────────────────────── -->
			<div class="grid h-[calc(100vh-52px)] grid-cols-[1fr_420px] gap-px bg-neutral-800">
				<!-- ─── Left: Signal Timeline ─────────────────────── -->
				<div class="flex flex-col bg-neutral-950">
					<div class="border-b border-neutral-800 px-4 py-2">
						<h2 class="font-mono text-xs tracking-widest text-neutral-500 uppercase">Signal Timeline</h2>
					</div>
					<div class="flex-1 overflow-y-auto px-4 py-2" id="signal-timeline">
						{#each sortedEvents as event (event.id)}
							{@const sourceStyle = SOURCE_COLORS[event.source] || SOURCE_COLORS.external}
							{@const isNew = newEventIds.has(event.id)}
							<div
								class="mb-1 flex items-start gap-3 rounded px-2 py-1.5 font-mono text-xs transition-all duration-500"
								class:bg-neutral-900={!isNew}
								class:bg-neutral-800={isNew}
								class:animate-slide-in={isNew}
							>
								<span class="shrink-0 tabular-nums text-neutral-600">
									{formatTime(event.timestamp)}
								</span>
								<span
									class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase {sourceStyle.bg} {sourceStyle.text}"
								>
									{sourceStyle.label}
								</span>
								<span class="text-neutral-300">{event.type}</span>
								{#if Object.keys(event.data).length > 0}
									<span class="truncate text-neutral-600">
										{JSON.stringify(event.data)}
									</span>
								{/if}
							</div>
						{/each}

						{#if sortedEvents.length === 0}
							<p class="py-8 text-center text-xs text-neutral-700">Waiting for signals...</p>
						{/if}
					</div>
				</div>

				<!-- ─── Right Panels ──────────────────────────────── -->
				<div class="flex flex-col gap-px bg-neutral-800">
					<!-- ─── Persona Vector ────────────────────────── -->
					<div class="bg-neutral-950 p-4">
						<h2 class="mb-3 font-mono text-xs tracking-widest text-neutral-500 uppercase">Persona Vector</h2>

						{#if sessionData.inference}
							{@const inf = sessionData.inference}
							<div class="space-y-2">
								{#each ['gatherer', 'hunter', 'researcher', 'gifter'] as persona}
									{@const prob = inf.probabilities[persona as keyof typeof inf.probabilities]}
									{@const isPrimary = inf.primary === persona}
									<div class="flex items-center gap-3">
										<span
											class="w-20 font-mono text-xs {isPrimary ? PERSONA_TEXT_COLORS[persona] + ' font-bold' : 'text-neutral-500'}"
										>
											{persona}
										</span>
										<div class="relative h-4 flex-1 overflow-hidden rounded bg-neutral-800">
											<div
												class="h-full rounded transition-all duration-700 ease-out {PERSONA_COLORS[persona]}"
												style="width: {prob * 100}%"
											></div>
										</div>
										<span class="w-10 text-right font-mono text-xs tabular-nums {isPrimary ? 'text-neutral-200' : 'text-neutral-600'}">
											{formatPercent(prob)}
										</span>
									</div>
								{/each}
							</div>

							<!-- Confidence gap -->
							<div class="mt-3 flex items-center gap-2 font-mono text-xs text-neutral-600">
								<span>confidence gap:</span>
								<span class="text-neutral-400">{formatPercent(inf.confidence)}</span>
							</div>

							<!-- Modifiers -->
							<div class="mt-3 space-y-1.5">
								<h3 class="font-mono text-[10px] tracking-widest text-neutral-600 uppercase">Modifiers</h3>
								{#each [
									['price sensitivity', inf.modifiers.priceSensitivity],
									['urgency', inf.modifiers.urgency],
									['familiarity', inf.modifiers.familiarityWithStore],
								] as [label, value]}
									<div class="flex items-center gap-3">
										<span class="w-28 font-mono text-[10px] text-neutral-600">{label}</span>
										<div class="relative h-1.5 flex-1 overflow-hidden rounded bg-neutral-800">
											<div
												class="h-full rounded bg-neutral-500 transition-all duration-700"
												style="width: {(value as number) * 100}%"
											></div>
										</div>
										<span class="w-8 text-right font-mono text-[10px] tabular-nums text-neutral-600">
											{formatPercent(value as number)}
										</span>
									</div>
								{/each}
							</div>

							<!-- Shift detection -->
							{#if inf.shift.detected}
								<div
									class="mt-3 rounded border px-3 py-2 font-mono text-xs transition-colors duration-300"
									class:border-amber-600={shiftFlash}
									class:bg-amber-950={shiftFlash}
									class:text-amber-300={shiftFlash}
									class:border-neutral-700={!shiftFlash}
									class:text-neutral-400={!shiftFlash}
								>
									<div class="font-semibold uppercase">Shift Detected</div>
									<div class="mt-1">
										<span class={PERSONA_TEXT_COLORS[inf.shift.from ?? ''] ?? 'text-neutral-500'}>{inf.shift.from}</span>
										<span class="text-neutral-600"> &rarr; </span>
										<span class={PERSONA_TEXT_COLORS[inf.primary]}>{inf.primary}</span>
									</div>
									{#if inf.shift.trigger}
										<div class="mt-1 text-[10px] text-neutral-600">{inf.shift.trigger}</div>
									{/if}
								</div>
							{/if}
						{/if}
					</div>

					<!-- ─── Layout Decision Log ──────────────────── -->
					<div class="bg-neutral-950 p-4">
						<h2 class="mb-3 font-mono text-xs tracking-widest text-neutral-500 uppercase">Layout Decision</h2>

						{#if latestLog}
							<div class="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
								<span class="text-neutral-600">type</span>
								<span class="text-neutral-300">{latestLog.type}</span>
								<span class="text-neutral-600">persona</span>
								<span class={PERSONA_TEXT_COLORS[latestLog.persona] ?? 'text-neutral-300'}>{latestLog.persona}</span>
								<span class="text-neutral-600">category</span>
								<span class="text-neutral-300">{latestLog.categorySlug}</span>
								<span class="text-neutral-600">cache</span>
								<span class={latestLog.cacheHit ? 'text-emerald-400' : 'text-amber-400'}>
									{latestLog.cacheHit ? 'HIT' : 'MISS'}
								</span>
								<span class="text-neutral-600">generation</span>
								<span class="tabular-nums text-neutral-300">{latestLog.generationMs}ms</span>
								<span class="text-neutral-600">tokens</span>
								<span class="tabular-nums text-neutral-300">
									{latestLog.inputTokens ?? '?'} in / {latestLog.outputTokens ?? '?'} out
								</span>
								<span class="text-neutral-600">time</span>
								<span class="text-neutral-500">{new Date(latestLog.createdAt).toLocaleTimeString()}</span>
							</div>

							<!-- Cumulative stats -->
							{@const stats = cumulativeStats}
							<div class="mt-3 border-t border-neutral-800 pt-3">
								<h3 class="mb-1 font-mono text-[10px] tracking-widest text-neutral-600 uppercase">Cumulative ({stats.count} generations)</h3>
								<div class="grid grid-cols-3 gap-2 font-mono text-xs">
									<div>
										<div class="text-neutral-600">cache hit</div>
										<div class="tabular-nums text-neutral-300">{stats.cacheHitRate}%</div>
									</div>
									<div>
										<div class="text-neutral-600">avg time</div>
										<div class="tabular-nums text-neutral-300">{stats.avgMs}ms</div>
									</div>
									<div>
										<div class="text-neutral-600">total tokens</div>
										<div class="tabular-nums text-neutral-300">{stats.totalTokens.toLocaleString()}</div>
									</div>
								</div>
							</div>
						{:else}
							<p class="font-mono text-xs text-neutral-700">No generations yet.</p>
						{/if}
					</div>

					<!-- ─── Product Enrichment (expandable) ──────── -->
					<div class="bg-neutral-950 p-4">
						<button
							onclick={() => enrichmentOpen = !enrichmentOpen}
							class="flex w-full items-center justify-between font-mono text-xs tracking-widest text-neutral-500 uppercase hover:text-neutral-400"
						>
							<span>Product Enrichment</span>
							<span class="text-lg leading-none">{enrichmentOpen ? '\u2212' : '+'}</span>
						</button>

						{#if enrichmentOpen}
							<div class="mt-3">
								<p class="font-mono text-[10px] text-neutral-600">
									Product enrichment data is available via the enriched_products table.
									Browse a category on the storefront to see persona-fit scores here.
								</p>
								<!-- Enrichment data would be loaded per-category in a full implementation.
								     For the demo, the inference panel and layout decisions show the
								     persona-product relationship clearly. -->
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}

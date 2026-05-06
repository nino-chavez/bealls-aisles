/**
 * Session-replay state machine — drives the dev-mode replay feature.
 *
 * Replays a curated anonymized shopper journey by firing signal events into
 * the global emitter at compressed timing, navigating the browser at category
 * boundaries, and letting the inference engine + AI layout react in real time.
 *
 * Fixtures live at /static/dev-fixtures/replay-sessions.json and are loaded
 * lazily on first use. The replay engine emits signals only — server-side
 * cold-start prior overrides flow via the `_replay_ref` query param the picker
 * appends to the entry path so the cohort prior gets seeded as if the shopper
 * really arrived from that referrer.
 */

import { goto } from '$app/navigation';
import { getEmitter } from '$lib/signals/emitter';
import type { SignalEventType } from '$lib/signals/types';

export interface ReplayEvent {
	atSecondsFromStart: number;
	type: 'VIEW_CATEGORY' | 'VIEW_PRODUCT' | 'SEARCH' | 'ADD_TO_CART' | 'CHECKOUT';
	category?: string;
	productLabel?: string;
	query?: string;
	label?: string;
}

export interface ReplaySession {
	id: string;
	label: string;
	narrative: string;
	groundTruthPersona: 'researcher' | 'hunter' | 'gatherer' | 'gifter';
	sourceSessionId?: string;
	entry: { path: string; referrer: string };
	events: ReplayEvent[];
}

// ─── Reactive state ────────────────────────────────────────────────

let sessions = $state<ReplaySession[]>([]);
let loadError = $state<string | null>(null);
let active = $state<{
	session: ReplaySession;
	nextEventIdx: number;
	startedAt: number;
	timer: ReturnType<typeof setTimeout> | null;
	lastFired: ReplayEvent | null;
} | null>(null);

// ─── Public API ────────────────────────────────────────────────────

export async function loadSessions(): Promise<void> {
	if (sessions.length > 0 || loadError) return;
	try {
		const res = await fetch('/dev-fixtures/replay-sessions.json');
		if (!res.ok) {
			loadError = `HTTP ${res.status}`;
			return;
		}
		sessions = await res.json();
	} catch (err) {
		loadError = err instanceof Error ? err.message : 'load failed';
	}
}

export function listSessions(): ReplaySession[] {
	return sessions;
}

export function getLoadError(): string | null {
	return loadError;
}

export function startReplay(id: string): void {
	if (active) stopReplay();
	const session = sessions.find((s) => s.id === id);
	if (!session) return;

	const url = new URL(session.entry.path, window.location.origin);
	url.searchParams.set('_replay_ref', session.entry.referrer);
	url.searchParams.set('dev', '1');
	void goto(url.pathname + url.search);

	active = {
		session,
		nextEventIdx: 0,
		startedAt: Date.now(),
		timer: null,
		lastFired: null,
	};
	scheduleNextEvent();
}

export function stopReplay(): void {
	if (active?.timer) clearTimeout(active.timer);
	active = null;
}

export interface ReplayStatus {
	sessionId: string;
	label: string;
	narrative: string;
	groundTruthPersona: ReplaySession['groundTruthPersona'];
	progress: number;
	firedCount: number;
	totalCount: number;
	lastFired: ReplayEvent | null;
	nextEvent: ReplayEvent | null;
	nextInSeconds: number | null;
}

export function getReplayStatus(): ReplayStatus | null {
	if (!active) return null;
	const total = active.session.events.length;
	const next = active.session.events[active.nextEventIdx] ?? null;
	const elapsed = (Date.now() - active.startedAt) / 1000;
	return {
		sessionId: active.session.id,
		label: active.session.label,
		narrative: active.session.narrative,
		groundTruthPersona: active.session.groundTruthPersona,
		progress: total === 0 ? 0 : active.nextEventIdx / total,
		firedCount: active.nextEventIdx,
		totalCount: total,
		lastFired: active.lastFired,
		nextEvent: next,
		nextInSeconds: next ? Math.max(0, next.atSecondsFromStart - elapsed) : null,
	};
}

// ─── Internals ─────────────────────────────────────────────────────

function scheduleNextEvent(): void {
	if (!active) return;
	const evt = active.session.events[active.nextEventIdx];
	if (!evt) {
		// Drain emitter so the final cart/search signals reach the panel
		void getEmitter()?.flush();
		active = null;
		return;
	}
	const elapsed = (Date.now() - active.startedAt) / 1000;
	const wait = Math.max(0, evt.atSecondsFromStart - elapsed) * 1000;
	active.timer = setTimeout(() => {
		fireEvent(evt);
		if (active) {
			active.lastFired = evt;
			active.nextEventIdx++;
			scheduleNextEvent();
		}
	}, wait);
}

function fireEvent(evt: ReplayEvent): void {
	const emitter = getEmitter();
	switch (evt.type) {
		case 'VIEW_CATEGORY': {
			if (evt.category) {
				void goto(`/category/${evt.category}`);
				emit(emitter, 'nav.category_view', { category: evt.category });
			}
			break;
		}
		case 'VIEW_PRODUCT': {
			// Signal-only — we don't navigate to a real PDP because the source
			// session's product slugs don't deterministically map to BC-generated
			// custom_url slugs. The inference engine reacts to the productViewCount
			// regardless of whether the URL changed.
			emit(emitter, 'nav.product_view', { productLabel: evt.productLabel });
			break;
		}
		case 'SEARCH': {
			emit(emitter, 'nav.search', { query: evt.query });
			break;
		}
		case 'ADD_TO_CART': {
			emit(emitter, 'commerce.add_to_cart', { productLabel: evt.productLabel });
			break;
		}
		case 'CHECKOUT': {
			// Navigate to the checkout surface; no specific signal type fires for
			// "checkout completed" in the engine. The category-prior change is
			// what shifts persona on this transition.
			void goto('/checkout');
			break;
		}
	}
	// Force flush so the dev panel sees the signal land within ~250ms instead
	// of waiting for the 5s interval. nav.* events normally batch.
	queueMicrotask(() => void emitter?.flush());
}

function emit(
	emitter: ReturnType<typeof getEmitter>,
	type: SignalEventType,
	data: Record<string, unknown>,
): void {
	if (!emitter) return;
	emitter.emit(type, data);
}

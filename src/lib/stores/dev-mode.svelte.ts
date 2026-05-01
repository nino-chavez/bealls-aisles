/**
 * Dev mode store — toggles the AI-zone visualization overlay.
 *
 * Activation:
 *   - URL `?dev=1` sets dev mode ON (and persists in localStorage)
 *   - URL `?dev=0` clears dev mode
 *   - DevToolbar's "Hide" button clears dev mode
 *
 * When active:
 *   - <body class="aisles-dev-mode"> is set
 *   - Each AI-composed zone shows a corner badge (zone ID + source + persona)
 *   - Floating DevToolbar shows session-wide context (persona, brand, latencies)
 *
 * Per-zone instrumentation lives in `LayoutRenderer.svelte`, `ZoneRenderer.svelte`,
 * and any inline AI section that wraps itself with `<DevZoneBadge>`. The CSS
 * for the badges only renders under `body.aisles-dev-mode` so non-dev users
 * see nothing.
 */

const STORAGE_KEY = 'aisles:dev-mode';

let active = $state(false);
let initialized = false;

export function initDevMode(): void {
	if (initialized || typeof window === 'undefined') return;
	initialized = true;

	const params = new URLSearchParams(window.location.search);
	const param = params.get('dev');
	if (param === '1' || param === 'true') {
		active = true;
		try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
	} else if (param === '0' || param === 'false') {
		active = false;
		try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
	} else {
		try { active = localStorage.getItem(STORAGE_KEY) === '1'; } catch { active = false; }
	}

	// Toggle <body> class for CSS-driven badge visibility.
	syncBodyClass();
}

function syncBodyClass(): void {
	if (typeof document === 'undefined') return;
	document.body.classList.toggle('aisles-dev-mode', active);
}

export function isDevMode(): boolean {
	return active;
}

export function setDevMode(value: boolean): void {
	active = value;
	try {
		if (value) localStorage.setItem(STORAGE_KEY, '1');
		else localStorage.removeItem(STORAGE_KEY);
	} catch { /* ignore */ }
	syncBodyClass();
}

export function toggleDevMode(): void {
	setDevMode(!active);
}

/** Per-generation entry the DevToolbar surfaces. */
export interface DevTraceEntry {
	at: number;
	surface: string;
	persona: string;
	brandId?: string;
	cacheHit: boolean;
	generationMs: number;
	zoneCount?: number;
}

let traces = $state<DevTraceEntry[]>([]);

export function pushTrace(entry: DevTraceEntry): void {
	traces = [entry, ...traces].slice(0, 20);
}

export function getTraces(): DevTraceEntry[] {
	return traces;
}

export function clearTraces(): void {
	traces = [];
}

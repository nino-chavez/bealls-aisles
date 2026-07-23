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
const FRESH_STORAGE_KEY = 'aisles:dev-fresh';
const FRESH_COOKIE = 'aisles_fresh';

let active = $state(false);
let freshMode = $state(false);
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

	// Hydrate fresh-mode from URL or localStorage. URL param wins so a
	// shared `?fresh=1` link forces it on; otherwise persisted state.
	const freshParam = params.get('fresh');
	if (freshParam === '1' || freshParam === 'true') {
		freshMode = true;
		try { localStorage.setItem(FRESH_STORAGE_KEY, '1'); } catch { /* ignore */ }
	} else if (freshParam === '0' || freshParam === 'false') {
		freshMode = false;
		try { localStorage.removeItem(FRESH_STORAGE_KEY); } catch { /* ignore */ }
	} else {
		try { freshMode = localStorage.getItem(FRESH_STORAGE_KEY) === '1'; } catch { freshMode = false; }
	}
	syncFreshCookie();
}

function syncBodyClass(): void {
	if (typeof document === 'undefined') return;
	document.body.classList.toggle('aisles-dev-mode', active);
}

/**
 * Mirror freshMode into a session cookie so the server-side cache helpers
 * (`shouldBypassCache`) see it on every request, including SSR loads.
 * `aisles_fresh=1` is read by `cache-flags.ts`.
 */
function syncFreshCookie(): void {
	if (typeof document === 'undefined') return;
	if (freshMode) {
		document.cookie = `${FRESH_COOKIE}=1; path=/; max-age=86400; SameSite=Lax`;
	} else {
		document.cookie = `${FRESH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
	}
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

/** Cache-bypass toggle. When true, every cache reader returns null/empty
 * — sets the `aisles_fresh` cookie that `shouldBypassCache` honors. */
export function isFreshMode(): boolean {
	return freshMode;
}

export function setFreshMode(value: boolean): void {
	freshMode = value;
	try {
		if (value) localStorage.setItem(FRESH_STORAGE_KEY, '1');
		else localStorage.removeItem(FRESH_STORAGE_KEY);
	} catch { /* ignore */ }
	syncFreshCookie();
}

export function toggleFreshMode(): void {
	setFreshMode(!freshMode);
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

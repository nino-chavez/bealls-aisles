/**
 * Server-side request signal extraction.
 *
 * Reads the same data that +page.server.ts previously extracted manually
 * (referrer, UTM, device, search query, intent param, cookies) and emits
 * it as structured SignalEvent objects into a SignalStore.
 */

import type { Persona } from './types';
import { PERSONAS } from './types';
import { SignalStore } from './store';

interface RequestContext {
	url: URL;
	request: Request;
	cookies: {
		get: (name: string) => string | undefined;
	};
	category: string;
}

/**
 * Create a SignalStore and populate it with request-time signals.
 * Returns the store ready for inference.
 */
export function createStoreFromRequest(ctx: RequestContext): SignalStore {
	const store = new SignalStore(crypto.randomUUID());

	// Cross-session state from cookies
	const storedPersonaRaw = ctx.cookies.get('aisles_persona') || null;
	const storedPersona = (storedPersonaRaw && PERSONAS.includes(storedPersonaRaw as Persona))
		? storedPersonaRaw as Persona
		: null;
	const storedCategory = ctx.cookies.get('aisles_last_category') || null;
	const visitCount = parseInt(ctx.cookies.get('aisles_visits') || '0') + 1;

	store.setCrossSessionContext({
		storedPersona,
		storedCategory,
		visitCount,
		currentCategory: ctx.category,
	});

	const userAgent = ctx.request.headers.get('user-agent') || '';
	const viewport = detectDeviceType(userAgent);
	const eventContext = {
		page: ctx.url.pathname,
		category: ctx.category,
		viewport,
	};

	// Emit request.pageview
	store.emit('request.pageview', 'request', {
		referrer: ctx.request.headers.get('referer') || null,
		utm_source: ctx.url.searchParams.get('utm_source') || null,
		utm_medium: ctx.url.searchParams.get('utm_medium') || null,
		utm_campaign: ctx.url.searchParams.get('utm_campaign') || null,
		intent: ctx.url.searchParams.get('intent') || null,
	}, eventContext);

	// Emit request.device
	store.emit('request.device', 'request', {
		userAgent,
		deviceType: viewport,
	}, eventContext);

	// Emit request.search_landing if search query present
	const searchQuery = ctx.url.searchParams.get('q');
	if (searchQuery) {
		store.emit('request.search_landing', 'request', {
			query: searchQuery,
		}, eventContext);
	}

	// Emit request.returning if visitor has history
	if (storedPersona || visitCount > 1) {
		store.emit('request.returning', 'request', {
			previousPersona: storedPersona,
			previousCategory: storedCategory,
			visitCount,
		}, eventContext);
	}

	return store;
}

function detectDeviceType(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
	if (/mobile|android.*mobile|iphone|ipod/i.test(userAgent)) return 'mobile';
	if (/tablet|ipad|android(?!.*mobile)/i.test(userAgent)) return 'tablet';
	return 'desktop';
}

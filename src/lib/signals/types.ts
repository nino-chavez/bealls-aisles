/**
 * Signal and inference types for Prism's persona detection system.
 *
 * Phase 2 replaces the one-shot regex → persona string with a continuous
 * signal stream → probability vector pipeline. These types define the
 * contract between signal sources, the inference engine, and layout generation.
 */

// ─── Personas ──────────────────────────────────────────────────────

export const PERSONAS = ['gatherer', 'hunter', 'researcher', 'gifter'] as const;
export type Persona = (typeof PERSONAS)[number];

// ─── Signal Event Schema ───────────────────────────────────────────

export type SignalSource =
	| 'request'     // Server-side, from HTTP request headers
	| 'navigation'  // Client-side, from page/route changes
	| 'interaction' // Client-side, from user actions (click, scroll, type)
	| 'commerce'    // Client-side, from cart/checkout actions
	| 'refinement'  // Client-side, from the refinement chat
	| 'external';   // Server-side, from CDP/BC/third-party

export type SignalEventType =
	// Request signals (server-side, page load)
	| 'request.pageview'
	| 'request.device'
	| 'request.geo'
	| 'request.search_landing'
	| 'request.returning'
	// Navigation signals (client-side)
	| 'nav.category_view'
	| 'nav.product_view'
	| 'nav.search'
	| 'nav.back'
	// Interaction signals (client-side) — Phase 3
	| 'interact.scroll_depth'
	| 'interact.dwell_time'
	| 'interact.filter_use'
	| 'interact.sort_change'
	// Commerce signals (client-side)
	| 'commerce.add_to_cart'
	// Refinement signals (client-side)
	| 'refine.message';

export interface SignalEvent {
	id: string;
	sessionId: string;
	timestamp: number;
	sequence: number;
	type: SignalEventType;
	source: SignalSource;
	data: Record<string, unknown>;
	context: {
		page: string;
		category: string | null;
		viewport: 'mobile' | 'tablet' | 'desktop';
	};
}

// ─── Inference Output ──────────────────────────────────────────────

export interface PersonaProbabilities {
	gatherer: number;
	hunter: number;
	researcher: number;
	gifter: number;
}

export interface PersonaModifiers {
	priceSensitivity: number;  // 0 = price-insensitive, 1 = very price-driven
	urgency: number;           // 0 = browsing, 1 = buying now
	familiarityWithStore: number; // 0 = first visit, 1 = loyal customer
}

export interface PersonaShift {
	detected: boolean;
	from: Persona | null;
	trigger: string | null;
}

export interface PersonaInference {
	probabilities: PersonaProbabilities;
	primary: Persona;
	confidence: number;        // How far ahead the primary is from second place
	modifiers: PersonaModifiers;
	shift: PersonaShift;
	signalCount: number;
	lastUpdated: number;
	dominantSource: SignalSource;
}

// ─── Inference Rules ───────────────────────────────────────────────

export interface PersonaScoreAdjustment {
	gatherer?: number;
	hunter?: number;
	researcher?: number;
	gifter?: number;
	priceSensitivity?: number;
	urgency?: number;
	familiarityWithStore?: number;
}

export interface InferenceRule {
	name: string;
	weight: number;
	evaluate: (ctx: InferenceContext) => PersonaScoreAdjustment | null;
}

/**
 * The context available to inference rules.
 * Phase 2: populated from request-time signals (URL, cookies, headers).
 * Phase 3+: populated from the full SignalStore with behavioral events.
 */
export interface InferenceContext {
	// Request-time signals (available now)
	intentParam: string | null;
	searchQuery: string | null;
	referrer: string | null;
	utmSource: string | null;
	utmMedium: string | null;
	utmCampaign: string | null;
	deviceType: 'mobile' | 'tablet' | 'desktop';
	hourOfDay: number;
	dayOfWeek: number; // 0 = Sunday
	// Cross-session signals (from cookies)
	storedPersona: Persona | null;
	storedCategory: string | null;
	visitCount: number;
	currentCategory: string;
}

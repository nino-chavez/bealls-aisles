/**
 * Signal Store: session-scoped buffer of SignalEvent objects.
 *
 * The store accumulates events, computes aggregates, and exposes
 * a toInferenceContext() method that the inference engine consumes.
 *
 * Phase 2: created per-request on the server. No persistence yet.
 * Phase 3: backed by Upstash Redis with 30-min session TTL.
 */

import type {
	SignalEvent,
	SignalEventType,
	SignalSource,
	InferenceContext,
	Persona,
} from './types';
export class SignalStore {
	readonly sessionId: string;
	private events: SignalEvent[] = [];
	private sequence = 0;

	// Cross-session state (populated from cookies on creation)
	private storedPersona: Persona | null = null;
	private storedCategory: string | null = null;
	private visitCount = 0;
	private currentCategory = '';

	constructor(sessionId: string) {
		this.sessionId = sessionId;
	}

	/** Set cross-session context from cookies. Called once at store creation. */
	setCrossSessionContext(opts: {
		storedPersona: Persona | null;
		storedCategory: string | null;
		visitCount: number;
		currentCategory: string;
	}) {
		this.storedPersona = opts.storedPersona;
		this.storedCategory = opts.storedCategory;
		this.visitCount = opts.visitCount;
		this.currentCategory = opts.currentCategory;
	}

	/** Append a signal event to the store. */
	emit(type: SignalEventType, source: SignalSource, data: Record<string, unknown>, context?: Partial<SignalEvent['context']>) {
		const event: SignalEvent = {
			id: crypto.randomUUID(),
			sessionId: this.sessionId,
			timestamp: Date.now(),
			sequence: this.sequence++,
			type,
			source,
			data,
			context: {
				page: context?.page ?? '/',
				category: context?.category ?? (this.currentCategory || null),
				viewport: context?.viewport ?? 'desktop',
			},
		};
		this.events.push(event);
		return event;
	}

	/** Get all events in order. */
	getEvents(): readonly SignalEvent[] {
		return this.events;
	}

	/** How many events are in the store. */
	get eventCount(): number {
		return this.events.length;
	}

	/**
	 * Build an InferenceContext from accumulated events + cross-session state.
	 * This is the bridge between the signal store and the inference engine.
	 */
	toInferenceContext(): InferenceContext {
		// Extract values from request-time events
		let intentParam: string | null = null;
		let searchQuery: string | null = null;
		let referrer: string | null = null;
		let utmSource: string | null = null;
		let utmMedium: string | null = null;
		let utmCampaign: string | null = null;
		let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
		let hourOfDay = new Date().getHours();
		let dayOfWeek = new Date().getDay();

		for (const event of this.events) {
			switch (event.type) {
				// Request-time signals (server-side)
				case 'request.pageview':
					referrer = (event.data.referrer as string) || null;
					utmSource = (event.data.utm_source as string) || null;
					utmMedium = (event.data.utm_medium as string) || null;
					utmCampaign = (event.data.utm_campaign as string) || null;
					intentParam = (event.data.intent as string) || null;
					break;
				case 'request.device':
					deviceType = (event.data.deviceType as 'mobile' | 'tablet' | 'desktop') || 'desktop';
					break;
				case 'request.search_landing':
					searchQuery = (event.data.query as string) || null;
					break;
				case 'request.returning':
					break;

				// Client-side signals — override context when they arrive
				case 'nav.search':
					searchQuery = (event.data.query as string) || null;
					break;
				case 'nav.category_view':
					if (event.data.category) {
						this.currentCategory = event.data.category as string;
					}
					break;
			}

			// Time context from the most recent event
			if (event.timestamp) {
				const d = new Date(event.timestamp);
				hourOfDay = d.getHours();
				dayOfWeek = d.getDay();
			}
		}

		return {
			intentParam,
			searchQuery,
			referrer,
			utmSource,
			utmMedium,
			utmCampaign,
			deviceType,
			hourOfDay,
			dayOfWeek,
			storedPersona: this.storedPersona,
			storedCategory: this.storedCategory,
			visitCount: this.visitCount,
			currentCategory: this.currentCategory,
		};
	}
}

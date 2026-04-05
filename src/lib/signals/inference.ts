/**
 * Inference engine: consumes an InferenceContext and outputs a PersonaInference.
 *
 * Phase 2: rule-based heuristics using request-time signals (URL params, cookies,
 * referrer, device, time). Same inputs as Phase 1's regex detection, but outputs
 * a probability vector instead of a single label.
 *
 * The rules are weighted and composable. Each rule examines some aspect of the
 * context and returns score adjustments. The engine sums them, normalizes to a
 * probability distribution, and computes confidence + shift detection.
 */

import {
	PERSONAS,
	type InferenceContext,
	type InferenceRule,
	type PersonaInference,
	type PersonaProbabilities,
	type Persona,
} from './types';

// ─── Rules ─────────────────────────────────────────────────────────

const rules: InferenceRule[] = [
	// Explicit intent param — strongest signal
	{
		name: 'intent-param',
		weight: 1.0,
		evaluate: (ctx) => {
			if (!ctx.intentParam) return null;
			const p = ctx.intentParam as Persona;
			if (!PERSONAS.includes(p)) return null;
			return { [p]: 0.8 };
		},
	},

	// Search query keyword patterns
	{
		name: 'search-hunter-keywords',
		weight: 0.9,
		evaluate: (ctx) => {
			if (!ctx.searchQuery) return null;
			const q = ctx.searchQuery.toLowerCase();
			if (/cheap|budget|deal|dorm|under \$|affordable|sale|discount|clearance/.test(q)) {
				return { hunter: 0.4, priceSensitivity: 0.5 };
			}
			return null;
		},
	},
	{
		name: 'search-researcher-keywords',
		weight: 0.9,
		evaluate: (ctx) => {
			if (!ctx.searchQuery) return null;
			const q = ctx.searchQuery.toLowerCase();
			if (/review|compare|spec|vs\b|rating|best|versus|dimension|material/.test(q)) {
				return { researcher: 0.4 };
			}
			return null;
		},
	},
	{
		name: 'search-gifter-keywords',
		weight: 0.9,
		evaluate: (ctx) => {
			if (!ctx.searchQuery) return null;
			const q = ctx.searchQuery.toLowerCase();
			if (/gift|birthday|anniversary|present|for him|for her|housewarming|wedding/.test(q)) {
				return { gifter: 0.5 };
			}
			return null;
		},
	},
	{
		name: 'search-gatherer-keywords',
		weight: 0.8,
		evaluate: (ctx) => {
			if (!ctx.searchQuery) return null;
			const q = ctx.searchQuery.toLowerCase();
			if (/browse|explore|inspiration|ideas|modern|style|aesthetic|cozy/.test(q)) {
				return { gatherer: 0.3 };
			}
			return null;
		},
	},

	// Referrer signals
	{
		name: 'referrer-social',
		weight: 0.7,
		evaluate: (ctx) => {
			if (!ctx.referrer) return null;
			const r = ctx.referrer.toLowerCase();
			if (/pinterest|instagram|houzz/.test(r)) {
				return { gatherer: 0.3 };
			}
			return null;
		},
	},
	{
		name: 'referrer-deal-site',
		weight: 0.7,
		evaluate: (ctx) => {
			if (!ctx.referrer) return null;
			const r = ctx.referrer.toLowerCase();
			if (/slickdeals|retailmenot|honey|google\.com\/shopping/.test(r)) {
				return { hunter: 0.3, priceSensitivity: 0.3 };
			}
			return null;
		},
	},
	{
		name: 'referrer-review-site',
		weight: 0.7,
		evaluate: (ctx) => {
			if (!ctx.referrer) return null;
			const r = ctx.referrer.toLowerCase();
			if (/wirecutter|consumerreports|reddit/.test(r)) {
				return { researcher: 0.3 };
			}
			return null;
		},
	},

	// UTM signals
	{
		name: 'utm-gift-campaign',
		weight: 0.8,
		evaluate: (ctx) => {
			const campaign = (ctx.utmCampaign || '').toLowerCase();
			const source = (ctx.utmSource || '').toLowerCase();
			if (/gift|holiday|mother|father|wedding/.test(campaign) || /gift/.test(source)) {
				return { gifter: 0.4 };
			}
			return null;
		},
	},
	{
		name: 'utm-sale-campaign',
		weight: 0.7,
		evaluate: (ctx) => {
			const campaign = (ctx.utmCampaign || '').toLowerCase();
			if (/sale|clearance|deal|promo/.test(campaign)) {
				return { hunter: 0.2, priceSensitivity: 0.3 };
			}
			return null;
		},
	},

	// Device + time signals
	{
		name: 'mobile-evening-impulse',
		weight: 0.5,
		evaluate: (ctx) => {
			if (ctx.deviceType === 'mobile' && (ctx.hourOfDay >= 20 || ctx.hourOfDay <= 5)) {
				return { hunter: 0.1, urgency: 0.2 };
			}
			return null;
		},
	},
	{
		name: 'desktop-weekday-deliberate',
		weight: 0.4,
		evaluate: (ctx) => {
			if (ctx.deviceType === 'desktop' && ctx.dayOfWeek >= 1 && ctx.dayOfWeek <= 5 && ctx.hourOfDay >= 9 && ctx.hourOfDay <= 17) {
				return { researcher: 0.1 };
			}
			return null;
		},
	},

	// Cross-session signals
	{
		name: 'returning-same-category',
		weight: 0.7,
		evaluate: (ctx) => {
			if (!ctx.storedPersona || ctx.storedCategory !== ctx.currentCategory) return null;
			// Boost the stored persona — continuity
			return { [ctx.storedPersona]: 0.3, familiarityWithStore: 0.2 };
		},
	},
	{
		name: 'returning-different-category',
		weight: 0.5,
		evaluate: (ctx) => {
			if (!ctx.storedPersona || ctx.storedCategory === ctx.currentCategory) return null;
			// Soft continuity — stored persona still gets a mild boost
			return { [ctx.storedPersona]: 0.1, familiarityWithStore: 0.1 };
		},
	},
	{
		name: 'repeat-visitor-familiarity',
		weight: 0.5,
		evaluate: (ctx) => {
			if (ctx.visitCount <= 1) return null;
			const familiarity = Math.min(ctx.visitCount / 10, 1.0);
			return { familiarityWithStore: familiarity * 0.3 };
		},
	},
];

// ─── Engine ────────────────────────────────────────────────────────

/** Base prior — slight lean toward gatherer (most common cold-start persona) */
const BASE_SCORES: PersonaProbabilities = {
	gatherer: 0.3,
	hunter: 0.2,
	researcher: 0.2,
	gifter: 0.1,
};

export function infer(ctx: InferenceContext): PersonaInference {
	const scores = { ...BASE_SCORES };
	let priceSensitivity = 0;
	let urgency = 0;
	let familiarityWithStore = ctx.visitCount > 1 ? 0.1 : 0;
	let signalCount = 0;
	let dominantSource: 'request' | 'navigation' = 'request';

	// Evaluate all rules
	for (const rule of rules) {
		const adjustment = rule.evaluate(ctx);
		if (!adjustment) continue;

		signalCount++;

		for (const persona of PERSONAS) {
			if (adjustment[persona]) {
				scores[persona] += adjustment[persona]! * rule.weight;
			}
		}
		if (adjustment.priceSensitivity) {
			priceSensitivity = Math.min(1, priceSensitivity + adjustment.priceSensitivity * rule.weight);
		}
		if (adjustment.urgency) {
			urgency = Math.min(1, urgency + adjustment.urgency * rule.weight);
		}
		if (adjustment.familiarityWithStore) {
			familiarityWithStore = Math.min(1, familiarityWithStore + adjustment.familiarityWithStore * rule.weight);
		}
	}

	// Normalize to probability distribution
	const total = scores.gatherer + scores.hunter + scores.researcher + scores.gifter;
	const probabilities: PersonaProbabilities = {
		gatherer: scores.gatherer / total,
		hunter: scores.hunter / total,
		researcher: scores.researcher / total,
		gifter: scores.gifter / total,
	};

	// Find primary persona and confidence
	const sorted = PERSONAS
		.map((p) => ({ persona: p, prob: probabilities[p] }))
		.sort((a, b) => b.prob - a.prob);

	const primary = sorted[0].persona;
	const confidence = sorted[0].prob - sorted[1].prob; // Gap between #1 and #2

	// Shift detection
	const shift = detectShift(primary, confidence, ctx);

	return {
		probabilities,
		primary,
		confidence,
		modifiers: {
			priceSensitivity,
			urgency,
			familiarityWithStore,
		},
		shift,
		signalCount,
		lastUpdated: Date.now(),
		dominantSource,
	};
}

function detectShift(
	primary: Persona,
	confidence: number,
	ctx: InferenceContext,
): PersonaInference['shift'] {
	if (!ctx.storedPersona || ctx.storedPersona === primary) {
		return { detected: false, from: null, trigger: null };
	}

	// Only flag a shift if the new primary has reasonable confidence
	if (confidence < 0.1) {
		return { detected: false, from: null, trigger: null };
	}

	// Determine what triggered the shift
	let trigger: string | null = null;
	if (ctx.searchQuery) {
		trigger = `search query "${ctx.searchQuery}" conflicts with stored ${ctx.storedPersona} model`;
	} else if (ctx.intentParam) {
		trigger = `explicit intent param override to ${ctx.intentParam}`;
	} else if (ctx.utmCampaign) {
		trigger = `UTM campaign "${ctx.utmCampaign}" suggests different intent`;
	} else if (ctx.referrer) {
		trigger = `referrer "${ctx.referrer}" suggests different intent`;
	}

	return {
		detected: true,
		from: ctx.storedPersona,
		trigger,
	};
}

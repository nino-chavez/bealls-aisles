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
	type PersonaScoreAdjustment,
	type Persona,
	type RuleMatch,
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

	// ─── Behavioral signals (in-session) ──────────────────────

	{
		name: 'broad-category-browsing',
		weight: 0.6,
		evaluate: (ctx) => {
			if (ctx.uniqueCategoriesViewed.length < 3) return null;
			// Browsing 3+ categories = exploratory gatherer behavior
			return { gatherer: 0.3 };
		},
	},
	{
		name: 'rapid-cart-adds',
		weight: 0.7,
		evaluate: (ctx) => {
			if (ctx.cartAddCount < 2) return null;
			// Multiple cart adds in one session = decisive hunter
			return { hunter: 0.3, urgency: 0.2 };
		},
	},
	{
		name: 'comparison-browsing',
		weight: 0.6,
		evaluate: (ctx) => {
			if (ctx.backNavigationCount < 2) return null;
			// Going back to grid multiple times = comparing products (researcher)
			return { researcher: 0.3 };
		},
	},
	{
		name: 'in-session-search',
		weight: 0.6,
		evaluate: (ctx) => {
			if (ctx.searchCount < 2) return null;
			// Multiple searches in one session = refining what they want (hunter or researcher)
			return { hunter: 0.15, researcher: 0.15 };
		},
	},
	{
		name: 'deep-product-exploration',
		weight: 0.5,
		evaluate: (ctx) => {
			if (ctx.productViewCount < 4) return null;
			// Viewing 4+ product pages = thorough research
			return { researcher: 0.25 };
		},
	},
	{
		name: 'refinement-chat-engaged',
		weight: 0.6,
		evaluate: (ctx) => {
			if (ctx.refineMessageCount === 0) return null;
			// Using the chat at all shows high engagement
			if (ctx.refineMessageCount >= 3) {
				return { researcher: 0.2, priceSensitivity: 0.1 };
			}
			return { hunter: 0.1 };
		},
	},
	{
		name: 'deep-scroll-exploration',
		weight: 0.5,
		evaluate: (ctx) => {
			if (ctx.maxScrollDepth < 75) return null;
			// Scrolled to bottom of page = thorough browsing
			return { gatherer: 0.15, researcher: 0.15 };
		},
	},
	{
		name: 'long-product-dwell',
		weight: 0.6,
		evaluate: (ctx) => {
			if (ctx.longDwellCount === 0) return null;
			// Spent 15s+ on product pages = reading carefully (not impulsive hunter)
			return { researcher: 0.25 };
		},
	},
	{
		name: 'quick-product-scanning',
		weight: 0.5,
		evaluate: (ctx) => {
			if (ctx.productViewCount < 3 || ctx.avgDwellTimeMs === 0) return null;
			if (ctx.avgDwellTimeMs > 8000) return null;
			// Short dwell + many views = scanning quickly (hunter behavior)
			return { hunter: 0.2, urgency: 0.1 };
		},
	},
	{
		name: 'single-category-focus',
		weight: 0.5,
		evaluate: (ctx) => {
			if (ctx.categoryViewCount < 3 || ctx.uniqueCategoriesViewed.length > 1) return null;
			// Multiple views but all in one category = focused intent
			return { hunter: 0.2 };
		},
	},

	// ─── Negative signals (Spotify skip-equivalent) ───────────

	{
		name: 'quick-bounce-pattern',
		weight: 0.6,
		evaluate: (ctx) => {
			if (ctx.quickBounceCount < 2) return null;
			// Multiple quick bounces (<3s dwell) = not finding what they want
			// Reduces hunter confidence (a hunter who found their target wouldn't bounce)
			return { gatherer: 0.2 };
		},
	},
	{
		name: 'cart-removal-indecision',
		weight: 0.7,
		evaluate: (ctx) => {
			if (ctx.cartRemovalCount === 0) return null;
			// Removing items from cart = reconsidering (researcher behavior)
			return { researcher: 0.2, priceSensitivity: 0.15 };
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
	const ruleMatches: RuleMatch[] = [];

	// Evaluate all rules
	for (const rule of rules) {
		const adjustment = rule.evaluate(ctx);
		if (!adjustment) continue;

		signalCount++;

		// Record the match with a human-readable reason
		ruleMatches.push({
			ruleName: rule.name,
			weight: rule.weight,
			adjustment,
			reason: describeRuleMatch(rule.name, ctx, adjustment),
		});

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
		ruleMatches,
	};
}

/** Generate a human-readable explanation for why a rule matched */
function describeRuleMatch(ruleName: string, ctx: InferenceContext, adj: PersonaScoreAdjustment): string {
	switch (ruleName) {
		case 'intent-param':
			return `URL param ?intent=${ctx.intentParam}`;
		case 'search-hunter-keywords':
			return `Search "${ctx.searchQuery}" matches deal/budget keywords`;
		case 'search-researcher-keywords':
			return `Search "${ctx.searchQuery}" matches research/comparison keywords`;
		case 'search-gifter-keywords':
			return `Search "${ctx.searchQuery}" matches gift/occasion keywords`;
		case 'search-gatherer-keywords':
			return `Search "${ctx.searchQuery}" matches inspiration/browse keywords`;
		case 'referrer-social':
			return `Referrer from social/visual platform: ${ctx.referrer}`;
		case 'referrer-deal-site':
			return `Referrer from deal site: ${ctx.referrer}`;
		case 'referrer-review-site':
			return `Referrer from review site: ${ctx.referrer}`;
		case 'utm-gift-campaign':
			return `UTM campaign "${ctx.utmCampaign}" indicates gifting intent`;
		case 'utm-sale-campaign':
			return `UTM campaign "${ctx.utmCampaign}" indicates deal-seeking`;
		case 'mobile-evening-impulse':
			return `Mobile device at ${ctx.hourOfDay}:00 — evening impulse pattern`;
		case 'desktop-weekday-deliberate':
			return `Desktop on weekday at ${ctx.hourOfDay}:00 — deliberate browsing`;
		case 'returning-same-category':
			return `Returning visitor, same category (${ctx.storedCategory}) — continuity boost for ${ctx.storedPersona}`;
		case 'returning-different-category':
			return `Returning visitor, different category (was ${ctx.storedCategory}, now ${ctx.currentCategory})`;
		case 'repeat-visitor-familiarity':
			return `Visit #${ctx.visitCount} — familiarity increases with repeat visits`;
		case 'broad-category-browsing':
			return `Browsed ${ctx.uniqueCategoriesViewed.length} categories (${ctx.uniqueCategoriesViewed.join(', ')}) — exploratory behavior`;
		case 'rapid-cart-adds':
			return `${ctx.cartAddCount} items added to cart — decisive, goal-oriented shopping`;
		case 'comparison-browsing':
			return `${ctx.backNavigationCount} back-navigations — comparing products in grid`;
		case 'in-session-search':
			return `${ctx.searchCount} searches this session — refining intent`;
		case 'deep-product-exploration':
			return `${ctx.productViewCount} product pages viewed — thorough research pattern`;
		case 'refinement-chat-engaged':
			return `${ctx.refineMessageCount} refinement messages — high engagement with AI assistant`;
		case 'deep-scroll-exploration':
			return `Scrolled to ${ctx.maxScrollDepth}% depth — exploring the full page`;
		case 'long-product-dwell':
			return `${ctx.longDwellCount} product page(s) with 15s+ dwell time — reading carefully`;
		case 'quick-product-scanning':
			return `${ctx.productViewCount} products viewed, avg ${Math.round(ctx.avgDwellTimeMs / 1000)}s each — scanning quickly`;
		case 'single-category-focus':
			return `${ctx.categoryViewCount} views in ${ctx.uniqueCategoriesViewed[0] || ctx.currentCategory} only — focused intent`;
		case 'quick-bounce-pattern':
			return `${ctx.quickBounceCount} product pages bounced in <3s — not finding what they want`;
		case 'cart-removal-indecision':
			return `${ctx.cartRemovalCount} item(s) removed from cart — reconsidering choices`;
		default: {
			const boosts = PERSONAS.filter((p) => adj[p] && adj[p]! > 0).map((p) => `+${adj[p]!.toFixed(1)} ${p}`);
			return boosts.length ? boosts.join(', ') : 'Rule matched';
		}
	}
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

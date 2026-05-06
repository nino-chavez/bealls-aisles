/**
 * Validates the inference engine against the design spine scenarios.
 *
 * These are the 3 acts from design-spine.md — the acceptance criteria
 * for whether persona detection works correctly. Run with:
 *   npx tsx src/lib/signals/inference.test.ts
 */

import { infer } from './inference';
import type { InferenceContext } from './types';

// ─── Helpers ───────────────────────────────────────────────────────

const defaults: InferenceContext = {
	intentParam: null,
	searchQuery: null,
	referrer: null,
	utmSource: null,
	utmMedium: null,
	utmCampaign: null,
	deviceType: 'desktop',
	hourOfDay: 10, // Saturday morning
	dayOfWeek: 6,  // Saturday
	brandId: 'bealls',
	storedPersona: null,
	storedCategory: null,
	visitCount: 0,
	currentCategory: 'living-room',
	categoryViewCount: 0,
	uniqueCategoriesViewed: [],
	productViewCount: 0,
	cartAddCount: 0,
	searchCount: 0,
	refineMessageCount: 0,
	backNavigationCount: 0,
	maxScrollDepth: 0,
	avgDwellTimeMs: 0,
	longDwellCount: 0,
	quickBounceCount: 0,
	cartRemovalCount: 0,
};

function ctx(overrides: Partial<InferenceContext>): InferenceContext {
	return { ...defaults, ...overrides };
}

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail: string) {
	if (condition) {
		console.log(`  PASS  ${name}`);
		passed++;
	} else {
		console.error(`  FAIL  ${name} — ${detail}`);
		failed++;
	}
}

// ─── Act 1: Cold Start — "modern living room furniture" ────────────

console.log('\nAct 1: Cold Start (new visitor, exploratory search)');
{
	const result = infer(ctx({
		searchQuery: 'modern living room furniture',
		referrer: 'https://www.google.com',
	}));

	assert(
		'Primary is gatherer',
		result.primary === 'gatherer',
		`got ${result.primary} (${JSON.stringify(result.probabilities)})`,
	);
	assert(
		'No persona shift',
		!result.shift.detected,
		`shift detected from ${result.shift.from}`,
	);
	assert(
		'Low price sensitivity',
		result.modifiers.priceSensitivity < 0.3,
		`priceSensitivity = ${result.modifiers.priceSensitivity}`,
	);
}

// ─── Act 2: Return Visit — Same Category, Continuity ──────────────

console.log('\nAct 2: Returning visitor, same category (continuity)');
{
	const result = infer(ctx({
		storedPersona: 'gatherer',
		storedCategory: 'living-room',
		visitCount: 2,
		currentCategory: 'living-room',
	}));

	assert(
		'Primary is still gatherer',
		result.primary === 'gatherer',
		`got ${result.primary} (${JSON.stringify(result.probabilities)})`,
	);
	assert(
		'No persona shift',
		!result.shift.detected,
		`shift detected from ${result.shift.from}`,
	);
	assert(
		'Some store familiarity',
		result.modifiers.familiarityWithStore > 0,
		`familiarity = ${result.modifiers.familiarityWithStore}`,
	);
}

// ─── Act 3: Return Visit — "dorm room desk" ───────────────────────

console.log('\nAct 3: Returning visitor, searches "dorm room desk" (persona shift)');
{
	const result = infer(ctx({
		searchQuery: 'dorm room desk',
		storedPersona: 'gatherer',
		storedCategory: 'living-room',
		visitCount: 3,
		currentCategory: 'office',
	}));

	assert(
		'Primary shifts to hunter',
		result.primary === 'hunter',
		`got ${result.primary} (${JSON.stringify(result.probabilities)})`,
	);
	assert(
		'Persona shift detected',
		result.shift.detected,
		'no shift detected',
	);
	assert(
		'Shift is from gatherer',
		result.shift.from === 'gatherer',
		`shift.from = ${result.shift.from}`,
	);
	assert(
		'High price sensitivity',
		result.modifiers.priceSensitivity > 0.3,
		`priceSensitivity = ${result.modifiers.priceSensitivity}`,
	);
	assert(
		'Shift trigger mentions search query',
		result.shift.trigger?.includes('dorm room desk') ?? false,
		`trigger = ${result.shift.trigger}`,
	);
}

// ─── Edge Cases ────────────────────────────────────────────────────

console.log('\nEdge: Explicit intent param overrides everything');
{
	const result = infer(ctx({
		intentParam: 'hunter',
		searchQuery: 'browse inspiration ideas',
		storedPersona: 'gatherer',
		storedCategory: 'living-room',
		visitCount: 5,
	}));

	assert(
		'Primary follows intent param',
		result.primary === 'hunter',
		`got ${result.primary} (${JSON.stringify(result.probabilities)})`,
	);
}

console.log('\nEdge: Gift campaign UTM');
{
	const result = infer(ctx({
		utmCampaign: 'holiday-gift-guide',
		utmSource: 'email',
	}));

	assert(
		'Gifter gets a meaningful boost',
		result.probabilities.gifter > result.probabilities.researcher,
		`gifter=${result.probabilities.gifter.toFixed(2)}, researcher=${result.probabilities.researcher.toFixed(2)}`,
	);
}

console.log('\nEdge: Review-site referrer');
{
	const result = infer(ctx({
		referrer: 'https://www.wirecutter.com/reviews/best-desks',
	}));

	assert(
		'Researcher gets boosted above base',
		result.probabilities.researcher > 0.25, // base is ~0.22 without signals
		`researcher=${result.probabilities.researcher.toFixed(2)}`,
	);
}

console.log('\nEdge: Cold start with no signals');
{
	const result = infer(ctx({}));

	assert(
		'Defaults to gatherer',
		result.primary === 'gatherer',
		`got ${result.primary}`,
	);
	assert(
		'Probabilities sum to ~1.0',
		Math.abs(
			result.probabilities.gatherer +
			result.probabilities.hunter +
			result.probabilities.researcher +
			result.probabilities.gifter - 1.0
		) < 0.01,
		`sum = ${result.probabilities.gatherer + result.probabilities.hunter + result.probabilities.researcher + result.probabilities.gifter}`,
	);
}

console.log('\nEdge: Category-conditional priors');
{
	const sale = infer(ctx({ currentCategory: 'sale-furniture' }));
	const newArrivals = infer(ctx({ currentCategory: 'new-arrivals' }));
	const gifts = infer(ctx({ currentCategory: 'gift-guide' }));
	const reviews = infer(ctx({ currentCategory: 'desk-reviews' }));

	assert(
		'Sale category biases toward hunter',
		sale.primary === 'hunter',
		`sale primary=${sale.primary} (${JSON.stringify(sale.probabilities)})`,
	);
	assert(
		'New-arrivals biases toward gatherer',
		newArrivals.primary === 'gatherer',
		`new-arrivals primary=${newArrivals.primary}`,
	);
	assert(
		'Gift category biases toward gifter',
		gifts.primary === 'gifter',
		`gifts primary=${gifts.primary}`,
	);
	assert(
		'Review category biases toward researcher',
		reviews.primary === 'researcher',
		`reviews primary=${reviews.primary}`,
	);
}

console.log('\nEdge: Entropy is maximal on cold start, lower on strong signal');
{
	const cold = infer(ctx({}));
	const sharp = infer(ctx({ intentParam: 'hunter' }));

	assert(
		'Cold start has high entropy (close to log(4))',
		cold.entropy > 1.2,
		`cold entropy = ${cold.entropy.toFixed(3)}`,
	);
	assert(
		'Sharp signal has lower entropy than cold start',
		sharp.entropy < cold.entropy,
		`sharp=${sharp.entropy.toFixed(3)} cold=${cold.entropy.toFixed(3)}`,
	);
	assert(
		'Certainty is in [0, 1]',
		sharp.certainty >= 0 && sharp.certainty <= 1 && cold.certainty >= 0 && cold.certainty <= 1,
		`sharp=${sharp.certainty}, cold=${cold.certainty}`,
	);
	assert(
		'Sharp signal certainty > cold certainty',
		sharp.certainty > cold.certainty,
		`sharp=${sharp.certainty.toFixed(3)}, cold=${cold.certainty.toFixed(3)}`,
	);
}

// ─── ADR-011: sleepcountry per-brand calibration ───────────────────

console.log('\nADR-011: sleepcountry referrer-keyed cold-start prior');
{
	const fb = infer(ctx({ brandId: 'sleepcountry', referrer: 'https://m.facebook.com/' }));
	assert(
		'facebook → hunter primary',
		fb.primary === 'hunter',
		`primary=${fb.primary} probs=${JSON.stringify(fb.probabilities)}`,
	);
	assert(
		'priorSource records the brand-referrer match',
		fb.priorSource?.type === 'brand-referrer' && fb.priorSource.referrerBucket === 'facebook',
		`priorSource=${JSON.stringify(fb.priorSource)}`,
	);

	const internal = infer(ctx({ brandId: 'sleepcountry', referrer: 'internal' }));
	assert(
		'internal → researcher primary',
		internal.primary === 'researcher',
		`primary=${internal.primary} probs=${JSON.stringify(internal.probabilities)}`,
	);

	// other brands ignore the table entirely
	const beallsFb = infer(ctx({ brandId: 'bealls', referrer: 'https://m.facebook.com/' }));
	assert(
		'bealls is unaffected by sleepcountry table',
		beallsFb.priorSource === undefined,
		`priorSource=${JSON.stringify(beallsFb.priorSource)}`,
	);
}

console.log('\nADR-011: per-brand rule overrides for sleepcountry');
{
	// referrer-social: sleepcountry should lift hunter; bealls should lift gatherer
	const sleepcSocial = infer(ctx({
		brandId: 'sleepcountry',
		referrer: 'https://www.instagram.com/',
	}));
	const beallsSocial = infer(ctx({
		brandId: 'bealls',
		referrer: 'https://www.instagram.com/',
	}));
	assert(
		'sleepcountry instagram → hunter > gatherer',
		sleepcSocial.probabilities.hunter > sleepcSocial.probabilities.gatherer,
		`hunter=${sleepcSocial.probabilities.hunter.toFixed(2)} gatherer=${sleepcSocial.probabilities.gatherer.toFixed(2)}`,
	);
	assert(
		'bealls instagram → gatherer > hunter',
		beallsSocial.probabilities.gatherer > beallsSocial.probabilities.hunter,
		`hunter=${beallsSocial.probabilities.hunter.toFixed(2)} gatherer=${beallsSocial.probabilities.gatherer.toFixed(2)}`,
	);

	// in-session-search: sleepcountry should drop the hunter half
	const searchSc = infer(ctx({ brandId: 'sleepcountry', searchCount: 3 }));
	const searchBealls = infer(ctx({ brandId: 'bealls', searchCount: 3 }));
	const scSearchRule = searchSc.ruleMatches.find((m) => m.ruleName === 'in-session-search');
	const beallsSearchRule = searchBealls.ruleMatches.find((m) => m.ruleName === 'in-session-search');
	assert(
		'sleepcountry in-session-search lifts only researcher',
		!!scSearchRule && !scSearchRule.adjustment.hunter && (scSearchRule.adjustment.researcher ?? 0) > 0,
		`adjustment=${JSON.stringify(scSearchRule?.adjustment)}`,
	);
	assert(
		'bealls in-session-search lifts both hunter and researcher',
		!!beallsSearchRule && !!beallsSearchRule.adjustment.hunter && !!beallsSearchRule.adjustment.researcher,
		`adjustment=${JSON.stringify(beallsSearchRule?.adjustment)}`,
	);

	// single-category-focus: sleepcountry → researcher; bealls → hunter
	const focusSc = infer(ctx({
		brandId: 'sleepcountry',
		categoryViewCount: 3,
		uniqueCategoriesViewed: ['mattresses'],
	}));
	const focusBealls = infer(ctx({
		brandId: 'bealls',
		categoryViewCount: 3,
		uniqueCategoriesViewed: ['women'],
	}));
	const scFocusRule = focusSc.ruleMatches.find((m) => m.ruleName === 'single-category-focus');
	const beallsFocusRule = focusBealls.ruleMatches.find((m) => m.ruleName === 'single-category-focus');
	assert(
		'sleepcountry single-category-focus lifts researcher',
		!!scFocusRule && !scFocusRule.adjustment.hunter && (scFocusRule.adjustment.researcher ?? 0) > 0,
		`adjustment=${JSON.stringify(scFocusRule?.adjustment)}`,
	);
	assert(
		'bealls single-category-focus lifts hunter',
		!!beallsFocusRule && (beallsFocusRule.adjustment.hunter ?? 0) > 0,
		`adjustment=${JSON.stringify(beallsFocusRule?.adjustment)}`,
	);
}

// ─── Summary ───────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);

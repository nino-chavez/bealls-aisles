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

// ─── Summary ───────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);

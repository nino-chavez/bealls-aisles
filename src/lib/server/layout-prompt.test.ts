/**
 * Verifies that buildLayoutPrompt textually reflects the probability vector,
 * so the AI layout generator has the information needed to differentiate
 * sharp (confident) from flat (ambiguous) posteriors.
 *
 * Run: npx tsx src/lib/server/layout-prompt.test.ts
 */

import { buildLayoutPrompt } from './layout-prompt';

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

const products = [
	{
		id: 'p1',
		name: 'Walnut coffee table',
		price: 499,
		salePrice: null,
		specs: { material: 'walnut', width: '48in', finish: 'matte' },
		personaFit: { gatherer: 0.8, hunter: 0.4, researcher: 0.6, gifter: 0.3 },
	} as unknown as Parameters<typeof buildLayoutPrompt>[2][number],
];

console.log('\nSharp vs flat probability vector');
{
	const sharp = buildLayoutPrompt(
		'hunter',
		'Sale Furniture',
		products,
		undefined,
		undefined,
		{ gatherer: 0.05, hunter: 0.9, researcher: 0.03, gifter: 0.02 },
	);
	const flat = buildLayoutPrompt(
		'hunter',
		'Sale Furniture',
		products,
		undefined,
		undefined,
		{ gatherer: 0.3, hunter: 0.35, researcher: 0.25, gifter: 0.1 },
	);

	assert(
		'Sharp prompt contains 90% hunter',
		sharp.includes('hunter 90%'),
		`no hunter 90% in sharp prompt`,
	);
	assert(
		'Flat prompt contains 35% hunter',
		flat.includes('hunter 35%'),
		`no hunter 35% in flat prompt`,
	);
	assert(
		'Sharp and flat prompts differ',
		sharp !== flat,
		'prompts identical — probability vector is decoration',
	);
	assert(
		'Sharp prompt reflects <25% secondaries (no blend hint activation)',
		sharp.includes('gatherer 5%') && sharp.includes('researcher 3%'),
		'sharp prompt missing low secondary percentages',
	);
	assert(
		'Flat prompt keeps researcher > 25% threshold visible',
		flat.includes('researcher 25%'),
		'flat prompt missing researcher 25%',
	);
}

console.log('\nPrompt without probabilities omits the blend hint');
{
	const noProbs = buildLayoutPrompt('hunter', 'Sale Furniture', products);
	const withProbs = buildLayoutPrompt('hunter', 'Sale Furniture', products, undefined, undefined, {
		gatherer: 0.05,
		hunter: 0.9,
		researcher: 0.03,
		gifter: 0.02,
	});

	assert(
		'No-probs prompt omits PROBABILITY VECTOR line',
		!noProbs.includes('PROBABILITY VECTOR'),
		'no-probs prompt leaked the probability line',
	);
	assert(
		'With-probs prompt includes PROBABILITY VECTOR line',
		withProbs.includes('PROBABILITY VECTOR'),
		'with-probs prompt missing the probability line',
	);
}

console.log('\nEmpty-surface rescue clamps the category line');
{
	// Empty/rescue surfaces source from the home loader (`categoryName: "Home"`).
	// Without clamping, the prompt emits `CATEGORY: Home` alongside the rescue
	// framing, and the AI confabulates "we didn't find 'Home' in our catalog"
	// on empty-search.
	const emptySearch = buildLayoutPrompt(
		'hunter',
		'Home',
		products,
		undefined,
		undefined,
		undefined,
		{ surface: 'empty', reason: 'empty-search' },
	);
	const homepage = buildLayoutPrompt('hunter', 'Home', products);

	assert(
		'Empty-search prompt omits CATEGORY: Home line',
		!emptySearch.includes('CATEGORY: Home'),
		'empty-search prompt still leaks "CATEGORY: Home"',
	);
	assert(
		'Empty-search prompt includes empty-search rescue framing',
		emptySearch.includes('zero results'),
		'empty-search rescue framing missing from prompt',
	);
	assert(
		'Empty-search prompt labels the surface as a rescue, not homepage',
		emptySearch.includes('empty-search rescue page')
			&& !emptySearch.includes('landing on the homepage'),
		'empty-search prompt still labels the surface as homepage',
	);
	assert(
		'Homepage prompt still includes CATEGORY: Home (regression check)',
		homepage.includes('CATEGORY: Home'),
		'homepage prompt lost its CATEGORY line',
	);
}

console.log('\nTag intents — surface intents into the prompt when present');
{
	// ADR-008 Phase A: when refinement chat extracted tag intents, the
	// prompt must surface them so the AI can rerank within the persona's
	// composition style. When absent, the tagIntents block must NOT leak
	// (regression check — empty intents shouldn't decorate the prompt).
	const withIntents = buildLayoutPrompt(
		'gatherer',
		'Women',
		products,
		undefined,
		undefined,
		undefined,
		{ surface: 'plp', tagIntents: ['cozy', 'warm'] },
	);
	const withoutIntents = buildLayoutPrompt(
		'gatherer',
		'Women',
		products,
		undefined,
		undefined,
		undefined,
		{ surface: 'plp' },
	);

	assert(
		'Tag intents prompt includes SHOPPER INTENT TAGS line',
		withIntents.includes('SHOPPER INTENT TAGS'),
		'tag intents block missing from prompt',
	);
	assert(
		'Tag intents prompt names every intent',
		withIntents.includes('"cozy"') && withIntents.includes('"warm"'),
		'specific intent names missing from prompt',
	);
	assert(
		'No-intents prompt omits SHOPPER INTENT TAGS line',
		!withoutIntents.includes('SHOPPER INTENT TAGS'),
		'tag intents block leaked into a no-intents prompt',
	);
	assert(
		'Empty intents array omits SHOPPER INTENT TAGS line',
		!buildLayoutPrompt('gatherer', 'Women', products, undefined, undefined, undefined, {
			surface: 'plp',
			tagIntents: [],
		}).includes('SHOPPER INTENT TAGS'),
		'empty intents leaked the block into the prompt',
	);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);

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

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);

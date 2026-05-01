/**
 * Verifies the tag-overlap rerank used by ADR-008 Phase A. Pure-function
 * over a synthetic catalog — no BC, no DB, no SvelteKit env.
 *
 * Run: npx tsx src/lib/server/tag-rerank.test.ts
 */

import { rankByTagAndPersona, type RerankProduct } from './tag-rerank';

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

interface Fixture extends RerankProduct {
	id: string;
}

function p(
	id: string,
	tags: string[],
	fit: { gatherer: number; hunter: number; researcher: number; gifter: number } | null = null,
): Fixture {
	return { id, semanticTags: tags, personaFit: fit };
}

console.log('\nPersona-only ranking (Q-012 fallback)');
{
	const products = [
		p('a', ['warm'], { gatherer: 0.9, hunter: 0.1, researcher: 0.1, gifter: 0.1 }),
		p('b', ['cozy'], { gatherer: 0.3, hunter: 0.1, researcher: 0.1, gifter: 0.1 }),
		p('c', [], { gatherer: 0.6, hunter: 0.1, researcher: 0.1, gifter: 0.1 }),
	];

	const noIntents = rankByTagAndPersona(products, 'gatherer', undefined);
	assert(
		'undefined tagIntents → persona-only ranking, all products retained',
		noIntents.length === 3 && noIntents[0].id === 'a' && noIntents[1].id === 'c' && noIntents[2].id === 'b',
		`got ${noIntents.map((x) => x.id).join(',')}`,
	);

	const empty = rankByTagAndPersona(products, 'gatherer', []);
	assert(
		'empty tagIntents → persona-only ranking, all products retained',
		empty.length === 3 && empty[0].id === 'a',
		`got ${empty.map((x) => x.id).join(',')}`,
	);
}

console.log('\nTag-overlap ranking — overlap dominates, persona breaks ties');
{
	const products = [
		// 3 overlap, low fit
		p('a', ['cozy', 'warm', 'casual'], { gatherer: 0.2, hunter: 0.2, researcher: 0.2, gifter: 0.2 }),
		// 2 overlap, high fit
		p('b', ['cozy', 'warm', 'unrelated'], { gatherer: 0.95, hunter: 0.1, researcher: 0.1, gifter: 0.1 }),
		// 2 overlap, lower fit (tie-break loser)
		p('c', ['cozy', 'casual', 'unrelated'], { gatherer: 0.55, hunter: 0.1, researcher: 0.1, gifter: 0.1 }),
		// 0 overlap (filtered out)
		p('d', ['unrelated'], { gatherer: 0.99, hunter: 0.1, researcher: 0.1, gifter: 0.1 }),
		// no tags (filtered out)
		p('e', [], { gatherer: 0.9, hunter: 0.1, researcher: 0.1, gifter: 0.1 }),
	];

	const ranked = rankByTagAndPersona(products, 'gatherer', ['cozy', 'warm', 'casual']);

	assert(
		'zero-overlap products are dropped',
		!ranked.some((r) => r.id === 'd' || r.id === 'e'),
		`got ${ranked.map((x) => x.id).join(',')}`,
	);
	assert(
		'highest overlap product ranks first regardless of fit',
		ranked[0].id === 'a',
		`expected a first, got ${ranked.map((x) => x.id).join(',')}`,
	);
	assert(
		'tie at overlap=2 broken by descending persona-fit',
		ranked.length === 3 && ranked[1].id === 'b' && ranked[2].id === 'c',
		`got ${ranked.map((x) => x.id).join(',')}`,
	);
}

console.log('\nTag-overlap matching is case-insensitive');
{
	const products = [
		p('a', ['Cozy', 'Vacation-Ready']),
		p('b', ['warm']),
	];

	const ranked = rankByTagAndPersona(products, 'gatherer', ['COZY', 'vacation-ready']);
	assert(
		'mixed-case intents match mixed-case product tags',
		ranked.length === 1 && ranked[0].id === 'a',
		`got ${ranked.map((x) => x.id).join(',')}`,
	);
}

console.log('\nNo persona — overlap orders without secondary sort');
{
	const products = [
		p('hi', ['cozy', 'warm']),
		p('lo', ['cozy']),
	];
	const ranked = rankByTagAndPersona(products, undefined, ['cozy', 'warm']);
	assert(
		'no persona supplied → overlap-only ranking still works',
		ranked.length === 2 && ranked[0].id === 'hi' && ranked[1].id === 'lo',
		`got ${ranked.map((x) => x.id).join(',')}`,
	);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);

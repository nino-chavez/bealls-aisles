/**
 * Verifies the vocabulary-constraint and prompt-formatting helpers used by
 * ADR-008 Phase A refinement-chat tag-intent extraction.
 *
 * Pure-function tests: no AI calls, no DB. The tests exercise the contract
 * the refine endpoint depends on — that hallucinated tags are dropped, that
 * generic NL produces an empty result, and that the prompt fragment is
 * stable across vocabulary sizes.
 *
 * Run: npx tsx src/lib/server/tag-intent.test.ts
 */

import { filterToVocabulary, formatTagVocabularyForPrompt } from './tag-intent';

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

console.log('\nVocabulary filtering — known tags pass, unknowns are dropped');
{
	const vocab = ['cozy', 'warm', 'casual', 'loungewear', 'breathable', 'vacation-ready'];

	const happy = filterToVocabulary(['cozy', 'warm', 'casual'], vocab);
	assert(
		'happy path returns all known tags in order',
		happy.length === 3 && happy[0] === 'cozy' && happy[1] === 'warm' && happy[2] === 'casual',
		`got ${JSON.stringify(happy)}`,
	);

	const mixed = filterToVocabulary(['cozy', 'fictional', 'warm', 'invented-tag'], vocab);
	assert(
		'unknown tags are dropped, known tags retained in order',
		mixed.length === 2 && mixed[0] === 'cozy' && mixed[1] === 'warm',
		`got ${JSON.stringify(mixed)}`,
	);

	const allUnknown = filterToVocabulary(['nonsense', 'made-up', 'garbage'], vocab);
	assert(
		'all-unknown returns empty array (no AI hallucination leaks)',
		allUnknown.length === 0,
		`got ${JSON.stringify(allUnknown)}`,
	);
}

console.log('\nVocabulary filtering — empty/fallback paths (Q-012)');
{
	const vocab = ['cozy', 'warm', 'casual'];

	assert(
		'undefined input → empty array',
		filterToVocabulary(undefined, vocab).length === 0,
		'undefined input did not return []',
	);

	assert(
		'empty array input → empty array',
		filterToVocabulary([], vocab).length === 0,
		'empty input did not return []',
	);

	assert(
		'empty vocabulary → empty array regardless of input',
		filterToVocabulary(['cozy', 'warm'], []).length === 0,
		'empty vocabulary leaked tags through',
	);
}

console.log('\nVocabulary filtering — case-insensitive match, canonical preserved');
{
	const vocab = ['Cozy', 'Vacation-Ready', 'BREATHABLE'];

	const result = filterToVocabulary(['cozy', 'VACATION-ready', 'breathable'], vocab);
	assert(
		'case-insensitive match returns canonical casing from vocabulary',
		result.length === 3 && result[0] === 'Cozy' && result[1] === 'Vacation-Ready' && result[2] === 'BREATHABLE',
		`got ${JSON.stringify(result)}`,
	);
}

console.log('\nVocabulary filtering — dedupe + cap');
{
	const vocab = ['cozy', 'warm', 'casual', 'soft', 'breathable', 'vacation-ready', 'durable', 'lightweight'];

	const dupes = filterToVocabulary(['cozy', 'COZY', 'cozy', 'warm'], vocab);
	assert(
		'duplicate tags collapsed to a single entry',
		dupes.length === 2 && dupes[0] === 'cozy' && dupes[1] === 'warm',
		`got ${JSON.stringify(dupes)}`,
	);

	const overcap = filterToVocabulary(
		['cozy', 'warm', 'casual', 'soft', 'breathable', 'vacation-ready', 'durable', 'lightweight'],
		vocab,
	);
	assert(
		'cap at 6 tags — strongest matches first, rest dropped',
		overcap.length === 6,
		`got ${overcap.length} tags`,
	);
}

console.log('\nPrompt formatting — vocabulary fragment shape');
{
	const promptEmpty = formatTagVocabularyForPrompt([]);
	assert(
		'empty vocabulary produces a prompt fragment that instructs the AI to return []',
		promptEmpty.includes('empty') && promptEmpty.includes('tagIntents=[]'),
		'empty-vocab prompt fragment is missing the empty-fallback instruction',
	);

	const vocab = ['cozy', 'warm', 'casual', 'breathable'];
	const promptShort = formatTagVocabularyForPrompt(vocab);
	assert(
		'short vocabulary lists every tag verbatim',
		vocab.every((t) => promptShort.includes(`- ${t}`)),
		'short-vocab prompt fragment dropped tags',
	);
	assert(
		'prompt fragment forbids hallucinated tags',
		promptShort.includes('Never invent tags'),
		'extraction-rule guard missing from prompt fragment',
	);
	assert(
		'prompt fragment surfaces the Q-012 fallback instruction',
		promptShort.includes('tagIntents=[]'),
		'Q-012 fallback instruction missing from prompt fragment',
	);
}

console.log('\nPrompt formatting — vocabulary cap at 200 tags');
{
	const huge = Array.from({ length: 250 }, (_, i) => `tag-${i}`);
	const prompt = formatTagVocabularyForPrompt(huge);
	assert(
		'200-tag cap honored (token budget protection)',
		prompt.includes('200/250') && prompt.includes('- tag-0') && !prompt.includes('- tag-200'),
		'prompt cap not applied or boundary tag leaked through',
	);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);

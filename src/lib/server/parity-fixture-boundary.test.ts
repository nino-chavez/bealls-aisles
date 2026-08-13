import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envKeys = [
	'AISLES_PARITY_FIXTURE', 'AISLES_ZONE_CONTENT_SCHEMA_VERSION',
	'OPENROUTER_API_KEY', 'DATABASE_URL',
] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
process.env.AISLES_PARITY_FIXTURE = 'v1';
process.env.AISLES_ZONE_CONTENT_SCHEMA_VERSION = 'route-bound-zone-content-v1';
process.env.OPENROUTER_API_KEY = 'fixture-must-not-use-this-key';
process.env.DATABASE_URL = 'postgresql://fixture-must-not-connect.invalid/db';

const [
	{ _setDbAccessObserverForTest },
	{ _setExternalSearchObserverForTest, searchProducts },
	{ getEnrichmentByEntityIds, getBrandTagVocabulary, getProductsByTagOverlap },
	{ getBrandVoiceOverride, getPersonaFitOverridesForBrand, getRouteZoneContents },
	{ getActiveRules },
	{ outcomesSummary },
	{ logGeneration },
	{ logZoneRetrieval },
] = await Promise.all([
	import('./db'),
	import('./search'),
	import('./enrichment/query'),
	import('./admin-overrides'),
	import('./rules'),
	import('./outcomes'),
	import('./generation-log'),
	import('./zone-retrieval-log'),
]);

let databaseAccesses = 0;
let searchStrategyAccesses = 0;
_setDbAccessObserverForTest(() => { databaseAccesses++; });
_setExternalSearchObserverForTest(() => { searchStrategyAccesses++; });

let failures = 0;
function assert(name: string, condition: boolean, detail = ''): void {
	if (condition) console.log(`PASS  ${name}`);
	else {
		console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
		failures++;
	}
}

try {
	const [
		search, enrichment, vocabulary, overlap, voice, personaOverrides, zoneRecords, rules, summary,
	] = await Promise.all([
		searchProducts('shirt', 20),
		getEnrichmentByEntityIds([8001]),
		getBrandTagVocabulary('bealls', true),
		getProductsByTagOverlap('bealls', 8001),
		getBrandVoiceOverride('bealls'),
		getPersonaFitOverridesForBrand('bealls'),
		getRouteZoneContents({
			organizationId: 'example-merchant', brandId: 'bealls', routePath: '/', surface: 'home',
			zoneIds: ['home.hero'], policyVersion: 'fixture-policy', referenceState: 'uncontracted',
			referenceId: null, referenceVersion: null,
		}),
		getActiveRules('hunter', 'women'),
		outcomesSummary(),
	]);
	await logGeneration({
		type: 'layout', persona: 'hunter', categorySlug: 'women', cacheHit: false, generationTimeMs: 1,
	});
	logZoneRetrieval({ surface: 'pdp', seedEntityId: 8001, brandId: 'bealls', zones: {} });

	assert('fixture search returns before OpenRouter even when a key is present',
		search.length === 0 && searchStrategyAccesses === 0);
	assert('fixture enrichment, tag overlap, persona, rules, and merchant records are empty',
		enrichment.size === 0 && vocabulary.length === 0 && overlap.length === 0 && voice === null
		&& personaOverrides.size === 0 && zoneRecords.size === 0 && rules.length === 0
		&& summary.total === 0);
	assert('fixture runtime performs zero database acquisitions across guarded paths', databaseAccesses === 0,
		`observed ${databaseAccesses}`);
	const enrichSource = readFileSync(fileURLToPath(new URL('./enrichment/enrich.ts', import.meta.url)), 'utf8');
	assert('offline enrichment also fails before credential and provider construction in fixture mode',
		enrichSource.indexOf("process.env.AISLES_PARITY_FIXTURE === 'v1'") < enrichSource.indexOf('const DATABASE_URL'));
} finally {
	_setDbAccessObserverForTest(null);
	_setExternalSearchObserverForTest(null);
	for (const key of envKeys) {
		const value = originalEnv[key];
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
}

if (failures) throw new Error(`${failures} parity fixture boundary test(s) failed`);

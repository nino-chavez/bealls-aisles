import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envKeys = [
	'AISLES_PARITY_FIXTURE', 'AISLES_ZONE_CONTENT_SCHEMA_VERSION',
	'OPENROUTER_API_KEY', 'DATABASE_URL', 'BRAND_ID',
	'KV_REST_API_URL', 'KV_REST_API_TOKEN',
	'BIGCOMMERCE_STORE_HASH', 'BEALLS_STOREFRONT_TOKEN', 'BIGCOMMERCE_STOREFRONT_TOKEN',
] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
process.env.AISLES_PARITY_FIXTURE = 'v1';
process.env.AISLES_ZONE_CONTENT_SCHEMA_VERSION = 'route-bound-v1';
process.env.OPENROUTER_API_KEY = 'fixture-must-not-use-this-key';
process.env.DATABASE_URL = 'postgresql://fixture-must-not-connect.invalid/db';
process.env.BRAND_ID = 'bealls';
process.env.KV_REST_API_URL = 'https://fixture-must-not-contact-upstash.invalid';
process.env.KV_REST_API_TOKEN = 'fixture-must-not-use-this-token';
process.env.BIGCOMMERCE_STORE_HASH = 'fixture-must-not-contact-bigcommerce';
process.env.BEALLS_STOREFRONT_TOKEN = 'fixture-must-not-use-this-token';
process.env.BIGCOMMERCE_STOREFRONT_TOKEN = 'fixture-must-not-use-this-token';

const originalFetch = globalThis.fetch;
let networkFetches = 0;
globalThis.fetch = (async () => {
	networkFetches++;
	throw new Error('fixture attempted an external fetch');
}) as typeof fetch;

const [
	{ _setDbAccessObserverForTest },
	{ _setExternalSearchObserverForTest, searchProducts },
	{ getEnrichmentByEntityIds, getBrandTagVocabulary, getProductsByTagOverlap },
	{ getBrandVoiceOverride, getPersonaFitOverridesForBrand, getRouteZoneContents },
	{ getActiveRules },
	{ outcomesSummary },
	{ logGeneration },
	{ logZoneRetrieval },
	{
		_setSessionRedisAccessObserverForTest, _resetSessionStateForTest,
		getSessionStore, persistSession, hasSession, listSessionIds,
	},
	{ createStoreFromRequest },
	{
		_setBigCommerceQueryAccessObserverForTest,
		getProducts, getProductsByCategory, getProductByPath, getProductsByEntityIds,
		getProductByEntityId, getCategories, createCart, addToCart, updateCartLineItem,
		deleteCartLineItem, deleteCart, getCart, createCartRedirectUrl,
	},
	{ _setDecisionCacheRedisAccessObserverForTest, invalidateDecisionCache },
] = await Promise.all([
	import('./db'),
	import('./search'),
	import('./enrichment/query'),
	import('./admin-overrides'),
	import('./rules'),
	import('./outcomes'),
	import('./generation-log'),
	import('./zone-retrieval-log'),
	import('../signals/session'),
	import('../signals/request'),
	import('./bigcommerce'),
	import('./cache'),
]);

let databaseAccesses = 0;
let searchStrategyAccesses = 0;
let sessionRedisAccesses = 0;
let decisionCacheRedisAccesses = 0;
let bigCommerceQueryAccesses = 0;
_setDbAccessObserverForTest(() => { databaseAccesses++; });
_setExternalSearchObserverForTest(() => { searchStrategyAccesses++; });
_setSessionRedisAccessObserverForTest(() => { sessionRedisAccesses++; });
_setDecisionCacheRedisAccessObserverForTest(() => { decisionCacheRedisAccesses++; });
_setBigCommerceQueryAccessObserverForTest(() => { bigCommerceQueryAccesses++; });

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

	const session = await getSessionStore('fixture-session', { fresh: true });
	await persistSession(session);
	const cookieValues = new Map<string, string>();
	await createStoreFromRequest({
		url: new URL('https://fixture.invalid/search?q=shirt'),
		request: new Request('https://fixture.invalid/search?q=shirt', { headers: { 'user-agent': 'fixture' } }),
		cookies: {
			get: (name: string) => cookieValues.get(name),
			set: (name: string, value: string) => { cookieValues.set(name, value); },
		},
		category: 'search',
	});
	const sessionAvailable = await hasSession('fixture-session');
	const sessionIds = await listSessionIds();

	const catalog = await getProducts(12);
	const category = await getProductsByCategory(9000);
	const productByPath = await getProductByPath('/parity-coastal-shirt/');
	const productsById = await getProductsByEntityIds([8001, 8002]);
	const productById = await getProductByEntityId(8001);
	const categories = await getCategories();
	const created = await createCart(8001, 1);
	const added = await addToCart(created.entityId, 8002, 2, created.version);
	const updated = await updateCartLineItem(
		created.entityId, 'parity-line-8002', 8002, 3, added.version,
	);
	const fetched = await getCart(created.entityId);
	const checkoutUrl = await createCartRedirectUrl(created.entityId);
	const deleted = await deleteCartLineItem(created.entityId, 'parity-line-8001', updated.version);
	await deleteCart(created.entityId);
	await invalidateDecisionCache();

	assert('fixture search returns before OpenRouter even when a key is present',
		search.length === 0 && searchStrategyAccesses === 0);
	assert('fixture enrichment, tag overlap, persona, rules, and merchant records are empty',
		enrichment.size === 0 && vocabulary.length === 0 && overlap.length === 0 && voice === null
		&& personaOverrides.size === 0 && zoneRecords.size === 0 && rules.length === 0
		&& summary.total === 0);
	assert('fixture runtime performs zero database acquisitions across guarded paths', databaseAccesses === 0,
		`observed ${databaseAccesses}`);
	assert('fixture session paths stay process-local with apparent Upstash credentials',
		sessionAvailable && sessionIds.includes('fixture-session') && sessionRedisAccesses === 0,
		`observed ${sessionRedisAccesses} Redis acquisitions`);
	assert('fixture catalog and commerce paths use deterministic fakes with zero BigCommerce calls',
		catalog.length === 12 && category.products.length === 12 && productByPath?.entityId === 8001
		&& productsById.length === 2 && productById?.entityId === 8001 && categories.length > 0
		&& created.lineItems.physicalItems.length === 1
		&& added.lineItems.physicalItems.length === 2
		&& updated.lineItems.physicalItems.find((item) => item.entityId === 'parity-line-8002')?.quantity === 3
		&& fetched?.lineItems.physicalItems.length === 2 && checkoutUrl === 'https://checkout.example.invalid/parity'
		&& deleted?.lineItems.physicalItems.length === 1
		&& bigCommerceQueryAccesses === 0,
		`observed ${bigCommerceQueryAccesses} BigCommerce query acquisitions`);
	assert('fixture decision cache never acquires an Upstash client', decisionCacheRedisAccesses === 0,
		`observed decision=${decisionCacheRedisAccesses}`);
	assert('hostile fixture credentials produce zero external fetches', networkFetches === 0,
		`observed ${networkFetches}`);
	const enrichSource = readFileSync(fileURLToPath(new URL('./enrichment/enrich.ts', import.meta.url)), 'utf8');
	assert('offline enrichment also fails before credential and provider construction in fixture mode',
		enrichSource.indexOf("process.env.AISLES_PARITY_FIXTURE === 'v1'") < enrichSource.indexOf('const DATABASE_URL'));
} finally {
	_setDbAccessObserverForTest(null);
	_setExternalSearchObserverForTest(null);
	_setBigCommerceQueryAccessObserverForTest(null);
	_setDecisionCacheRedisAccessObserverForTest(null);
	_resetSessionStateForTest();
	globalThis.fetch = originalFetch;
	for (const key of envKeys) {
		const value = originalEnv[key];
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
}

if (failures) throw new Error(`${failures} parity fixture boundary test(s) failed`);

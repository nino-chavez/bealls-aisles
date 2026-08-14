import {
	composeBoundedZones,
	productCandidates,
	resetBoundedAiRequestBudgetForTest,
	setBoundedAiProviderForTest,
	reorderBoundedProducts,
} from './bounded-ai';
import { normalizeTrustedShopperRoute } from '../brand/bealls-family-runtime-contract';
import { executeRouteZones } from './route-zone-runtime';

let failures = 0;
function assert(name: string, condition: boolean, detail = ''): void {
	if (condition) console.log(`PASS  ${name}`);
	else { console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); failures++; }
}

const context = normalizeTrustedShopperRoute('bealls', '/');
const candidates = productCandidates([
	{ id: 'p1', entityId: 101, name: 'First product', price: 24, salePrice: 19, image: '/p1.jpg', imageAlt: 'First product', description: '', specs: {}, tags: ['women'], category: 'Women' },
	{ id: 'p2', entityId: 102, name: 'Second product', price: 32, salePrice: 28, image: '/p2.jpg', imageAlt: 'Second product', description: '', specs: {}, tags: ['women'], category: 'Women' },
]);
const gate = (requestKey: string, sessionKey = requestKey) => ({ intent: 'observe' as const, requestKey, sessionKey });

const reordered = reorderBoundedProducts(candidates, ['p2', 'outside-catalog', 'p2', '101']);
assert('product ordering keeps known products only and never duplicates a product', reordered.length === 2
	&& reordered[0].id === 'p2' && reordered[1].id === 'p1');

const previousFlag = process.env.AISLES_BOUNDED_AI_ENABLED;
const previousGatewayKey = process.env.AI_GATEWAY_API_KEY;
process.env.AISLES_BOUNDED_AI_ENABLED = '0';
process.env.AI_GATEWAY_API_KEY = 'test-credential-present';
const disabled = await composeBoundedZones({ context, candidates, requestGate: gate('disabled'), safeFallbackZones: { 'home.hero': { component: 'editorial-header', props: { eyebrow: 'SAFE', headline: 'Fallback', body: 'Fallback body.' } } } });
assert('feature flag disables provider calls and preserves fallback output', disabled.ai.status === 'disabled'
	&& disabled.ai.callCount === 0 && 'home.hero' in disabled.fallbackOutput.zones);

process.env.AISLES_BOUNDED_AI_ENABLED = '1';
let gateProviderCalls = 0;
const restoreGateProvider = setBoundedAiProviderForTest(async () => {
	gateProviderCalls += 1;
	return { reasonCode: 'broad-merchandising', productOrder: ['p1'], zones: { 'home.hero': { variant: 'editorial-header' } } };
});
const noIntent = await composeBoundedZones({ context, candidates });
assert('credentials and the feature flag still require an intentional request', noIntent.ai.status === 'gated'
	&& noIntent.ai.gateReason === 'request-not-intentional' && noIntent.ai.callCount === 0 && gateProviderCalls === 0);
const gatedApplied = await composeBoundedZones({ context, candidates, requestGate: gate('gate-first', 'gate-session') });
const gatedCooldown = await composeBoundedZones({ context, candidates, requestGate: gate('gate-first', 'gate-session') });
assert('intentional Observe requests preserve real provider calls', gatedApplied.ai.status === 'applied' && gatedApplied.ai.callCount === 1);
assert('same-session reloads hit the bounded request cooldown', gatedCooldown.ai.status === 'cooldown'
	&& gatedCooldown.ai.gateReason === 'cooldown' && gatedCooldown.ai.callCount === 0 && gateProviderCalls === 1);
restoreGateProvider();
const restoreAppliedProvider = setBoundedAiProviderForTest(async ({ surface, prompt }) => {
	assert('provider receives the bounded surface prompt', surface === 'home' && prompt.includes('Do not invent IDs'));
	return {
		reasonCode: 'broad-merchandising',
		productOrder: ['p2', 'outside-catalog', 'p1'],
		zones: {
			'home.hero': { variant: 'editorial-header' },
			'home.editorial-strip': { variant: 'category-tiles' },
			'home.brand-spotlight': { variant: 'brand-spotlight' },
			'home.below-fold': { variant: 'locator-strip' },
		},
	};
});
const applied = await composeBoundedZones({ context, candidates, requestGate: gate('home-success') });
restoreAppliedProvider();
assert('successful provider output is materialized through existing named zone schemas', applied.ai.status === 'applied'
	&& applied.ai.callCount === 1 && applied.engineDecisionMode === 'model'
	&& applied.productOrder.join(',') === 'p2,p1'
	&& applied.engineOutput.zones['home.hero'] !== undefined
	&& applied.engineOutput.zones['home.editorial-strip'] !== undefined);

const restoreSurfaceProvider = setBoundedAiProviderForTest(async ({ surface }) => {
	if (surface === 'plp') return {
		reasonCode: 'bounded-ranking', productOrder: ['p2', 'p1'], zones: {
			'plp.banner': { variant: 'category-prompt' },
			'plp.editorial-header': { variant: 'shop-the-category' },
			'plp.cluster-row': { clusterKeys: ['shop-all', 'new-arrivals'] },
			'plp.between-thirds': { variant: 'category-prompt' },
		},
	};
	if (surface === 'pdp') return {
		reasonCode: 'related-products', zones: {
			'pdp.below-description': { variant: 'brand-spotlight' },
			'pdp.related': { titleKey: 'you-might-like', productIds: ['p2'] },
			'pdp.cross-sell': { titleKey: 'pairs-well-with', productIds: ['p1'] },
		},
	};
	if (surface === 'search') return {
		reasonCode: 'popular-products', zones: {
			'search.zero-results-rescue': { variant: 'popular-products', productIds: ['p1', 'p2'], categorySlugs: [] },
		},
	};
	if (surface === 'cart') return {
		reasonCode: 'cart-pairing', zones: {
			'cart.above-checkout-cta': { titleKey: 'complete-your-cart', productIds: ['p2'] },
		},
	};
	return {
		reasonCode: 'checkout-assurance', zones: {
		'checkout.assurance-strip': { variant: 'returning' },
	},
};
});
const surfaceCases = [
	['plp', normalizeTrustedShopperRoute('bealls', '/category/women'), candidates, 'plp.banner'],
	['pdp', normalizeTrustedShopperRoute('bealls', '/product/parity-coastal-shirt'), candidates, 'pdp.related'],
	['search', normalizeTrustedShopperRoute('bealls', '/search'), candidates, 'search.zero-results-rescue'],
	['cart', normalizeTrustedShopperRoute('bealls', '/cart'), candidates, 'cart.above-checkout-cta'],
	['checkout', normalizeTrustedShopperRoute('bealls', '/checkout'), [], 'checkout.assurance-strip'],
] as const;
for (const [surface, routeContext, surfaceCandidates, expectedZone] of surfaceCases) {
	const surfaceResult = await composeBoundedZones({
		context: routeContext,
		candidates: surfaceCandidates,
		requestGate: gate(`${surface}-surface`),
		categorySlug: 'women',
		categoryName: 'Women',
	});
	assert(`${surface} bounded surface publishes its named decision zone`, surfaceResult.ai.status === 'applied'
		&& surfaceResult.ai.callCount === 1 && surfaceResult.engineOutput.zones[expectedZone] !== undefined);
}
restoreSurfaceProvider();

const restoreFailedProvider = setBoundedAiProviderForTest(async () => { throw new Error('provider rejected request'); });
const failed = await composeBoundedZones({ context, candidates, requestGate: gate('failed'), safeFallbackZones: { 'home.hero': { component: 'editorial-header', props: { eyebrow: 'SAFE', headline: 'Fallback', body: 'Fallback body.' } } } });
restoreFailedProvider();
assert('provider failure returns bounded fallback evidence without partial model output', failed.ai.status === 'failed'
	&& failed.ai.callCount === 1 && failed.engineOutput.zones['home.hero'] === undefined
	&& failed.fallbackOutput.zones['home.hero'] !== undefined
	&& failed.ai.failureCode === 'provider-rejected'
	&& failed.ai.failureMessage?.includes('approved fallback') === true
	&& !JSON.stringify(failed).includes('provider rejected request'));
const failedExecution = await executeRouteZones({
	context,
	ai: failed.ai,
	safeFallbackOutput: failed.fallbackOutput.zones,
	merchantRecords: new Map(),
});
const failedHeroEvidence = failedExecution.decisions.find((decision) => decision.zoneId === 'home.hero')?.evidence;
assert('public zone evidence keeps raw provider detail server-side', failedHeroEvidence?.railLabel === 'failed'
	&& failedHeroEvidence.failureCode === 'provider-rejected'
	&& failedHeroEvidence.failureMessage?.includes('approved fallback') === true
	&& !JSON.stringify(failedHeroEvidence).includes('provider rejected request'));

const restoreTimeoutProvider = setBoundedAiProviderForTest(async () => new Promise<never>(() => undefined));
const timedOut = await composeBoundedZones({ context, candidates, requestGate: gate('timeout') });
restoreTimeoutProvider();
assert('provider timeout returns a failed bounded result', timedOut.ai.status === 'failed'
	&& timedOut.ai.callCount === 1 && timedOut.ai.failureCode === 'provider-timeout'
	&& timedOut.ai.failureMessage?.includes('timed out') === true);

const account = await composeBoundedZones({
	context: normalizeTrustedShopperRoute('bealls', '/account'),
	candidates,
});
assert('account has no model decision surface even when candidates exist', account.ai.callCount === 0
	&& account.engineOutput.zones['account.welcome'] === undefined);

if (previousFlag === undefined) delete process.env.AISLES_BOUNDED_AI_ENABLED;
else process.env.AISLES_BOUNDED_AI_ENABLED = previousFlag;
if (previousGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
else process.env.AI_GATEWAY_API_KEY = previousGatewayKey;
resetBoundedAiRequestBudgetForTest();

if (failures) throw new Error(`${failures} bounded AI test(s) failed`);

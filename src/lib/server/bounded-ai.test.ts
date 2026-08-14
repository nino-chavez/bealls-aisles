import {
	composeBoundedZones,
	productCandidates,
	setBoundedAiProviderForTest,
	reorderBoundedProducts,
} from './bounded-ai';
import { normalizeTrustedShopperRoute } from '../brand/bealls-family-runtime-contract';

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

const reordered = reorderBoundedProducts(candidates, ['p2', 'outside-catalog', 'p2', '101']);
assert('product ordering keeps known products only and never duplicates a product', reordered.length === 2
	&& reordered[0].id === 'p2' && reordered[1].id === 'p1');

const previousFlag = process.env.AISLES_BOUNDED_AI_ENABLED;
process.env.AISLES_BOUNDED_AI_ENABLED = '0';
const disabled = await composeBoundedZones({ context, candidates, safeFallbackZones: { 'home.hero': { component: 'editorial-header', props: { eyebrow: 'SAFE', headline: 'Fallback', body: 'Fallback body.' } } } });
assert('feature flag disables provider calls and preserves fallback output', disabled.ai.status === 'disabled'
	&& disabled.ai.callCount === 0 && 'home.hero' in disabled.fallbackOutput.zones);

process.env.AISLES_BOUNDED_AI_ENABLED = '1';
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
const applied = await composeBoundedZones({ context, candidates });
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
		categorySlug: 'women',
		categoryName: 'Women',
	});
	assert(`${surface} bounded surface publishes its named decision zone`, surfaceResult.ai.status === 'applied'
		&& surfaceResult.ai.callCount === 1 && surfaceResult.engineOutput.zones[expectedZone] !== undefined);
}
restoreSurfaceProvider();

const restoreFailedProvider = setBoundedAiProviderForTest(async () => { throw new Error('provider rejected request'); });
const failed = await composeBoundedZones({ context, candidates, safeFallbackZones: { 'home.hero': { component: 'editorial-header', props: { eyebrow: 'SAFE', headline: 'Fallback', body: 'Fallback body.' } } } });
restoreFailedProvider();
assert('provider failure returns bounded fallback evidence without partial model output', failed.ai.status === 'failed'
	&& failed.ai.callCount === 1 && failed.engineOutput.zones['home.hero'] === undefined
	&& failed.fallbackOutput.zones['home.hero'] !== undefined);

const restoreTimeoutProvider = setBoundedAiProviderForTest(async () => new Promise<never>(() => undefined));
const timedOut = await composeBoundedZones({ context, candidates });
restoreTimeoutProvider();
assert('provider timeout returns a failed bounded result', timedOut.ai.status === 'failed'
	&& timedOut.ai.callCount === 1 && timedOut.ai.failureReason?.includes('timeout') === true);

const account = await composeBoundedZones({
	context: normalizeTrustedShopperRoute('bealls', '/account'),
	candidates,
});
assert('account has no model decision surface even when candidates exist', account.ai.callCount === 0
	&& account.engineOutput.zones['account.welcome'] === undefined);

if (previousFlag === undefined) delete process.env.AISLES_BOUNDED_AI_ENABLED;
else process.env.AISLES_BOUNDED_AI_ENABLED = previousFlag;

if (failures) throw new Error(`${failures} bounded AI test(s) failed`);

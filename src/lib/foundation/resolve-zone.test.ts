/**
 * Executable zone authority tests.
 *
 * Run: npx tsx src/lib/foundation/resolve-zone.test.ts
 */

import { compileBrandCompositionPolicy } from '../brand/bealls-family-runtime-contract';
import {
	resolveZone,
	type TrustedMerchantZoneRecord,
	type ZoneResolution,
} from './resolve-zone';
import { enumerateZoneInstances, parseZoneInstance, ZONE_IDS, ZONES } from './zones';
import { ZoneSchemas } from './zone-schemas';

let failures = 0;
function assert(name: string, condition: boolean, detail = ''): void {
	if (condition) console.log(`PASS  ${name}`);
	else {
		console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
		failures++;
	}
}

function homeHero(eyebrow: string) {
	return {
		component: 'editorial-header' as const,
		props: { eyebrow, headline: 'Trusted headline', body: 'Trusted body.' },
	};
}

const related = {
	component: 'product-carousel' as const,
	props: {
		title: 'Related products',
		products: ['p1', 'p2', 'p3'].map((productId) => ({ productId, role: 'standard' as const })),
	},
};

const lastChance = {
	component: 'last-chance-upsell-row' as const,
	props: {
		title: 'Complete the order',
		products: ['p1', 'p2', 'p3'].map((productId) => ({ productId, role: 'compact' as const })),
	},
};

function resolveHomeHero(overrides: Partial<Parameters<typeof resolveZone>[0]> = {}): ZoneResolution {
	return resolveZone({
		zoneId: 'home.hero',
		brandId: 'bealls',
		routePath: '/',
		policy: compileBrandCompositionPolicy('bealls', 'home', 'home.hero'),
		...overrides,
	});
}

assert('catalog contains 28 zone families', ZONE_IDS.length === 28, String(ZONE_IDS.length));
assert('catalog expands to 36 concrete zone instances', enumerateZoneInstances().length === 36, String(enumerateZoneInstances().length));
assert('every expanded instance parses', enumerateZoneInstances().every((zoneId) => parseZoneInstance(zoneId) !== null));
assert('every family has exactly one runtime schema', ZONE_IDS.every((zoneId) => zoneId in ZoneSchemas)
	&& Object.keys(ZoneSchemas).every((zoneId) => zoneId in ZONES));

const fallback = resolveHomeHero();
assert('missing output terminates in the validated brand fallback', fallback.source === 'fallback'
	&& fallback.terminal === 'materialized'
	&& (fallback.content as { component?: string } | null)?.component === 'editorial-header');

const hidden = resolveZone({
	zoneId: 'home.featured-row.1',
	brandId: 'bealls',
	routePath: '/',
	policy: compileBrandCompositionPolicy('bealls', 'home', 'home.featured-row'),
});
assert('missing content terminates as trusted Hidden', hidden.source === 'fallback'
	&& hidden.terminal === 'hidden' && hidden.content === null);

let unknownThrew = false;
try {
	resolveZone({
		zoneId: 'home.featured-row.7',
		brandId: 'bealls',
		routePath: '/',
		policy: compileBrandCompositionPolicy('bealls', 'home', 'home.featured-row'),
	});
} catch {
	unknownThrew = true;
}
assert('unsupported expanded zone IDs fail closed', unknownThrew);

let policyMismatchThrew = false;
try {
	resolveZone({
		zoneId: 'home.hero',
		brandId: 'bealls',
		routePath: '/',
		policy: compileBrandCompositionPolicy('bealls', 'pdp', 'pdp.related'),
	});
} catch {
	policyMismatchThrew = true;
}
assert('a policy compiled for another surface/zone cannot publish', policyMismatchThrew);

const fixedModel = resolveHomeHero({
	engineOutput: { zones: { 'home.hero': homeHero('MODEL') } },
	engineDecisionMode: 'model',
	engineProvenance: { kind: 'model', approvedInputHash: 'a'.repeat(64), modelId: 'fixture-model' },
});
assert('model output cannot publish into a fixed zone', fixedModel.source === 'fallback');

const invalidExtraProps = resolveHomeHero({
	engineOutput: {
		zones: {
			'home.hero': {
				...homeHero('MODEL'),
				props: { ...homeHero('MODEL').props, className: 'invented' },
			},
		},
	},
	engineDecisionMode: 'model',
	engineProvenance: { kind: 'model', approvedInputHash: 'a'.repeat(64), modelId: 'fixture-model' },
});
assert('strict props reject styling invention before fallback', invalidExtraProps.source === 'fallback');

const relatedPolicy = compileBrandCompositionPolicy('bealls', 'pdp', 'pdp.related');
const trustedRules = resolveZone({
	zoneId: 'pdp.related',
	brandId: 'bealls',
	routePath: '/product/parity-shirt',
	policy: relatedPolicy,
	engineOutput: { zones: { 'pdp.related': related } },
	engineDecisionMode: 'rules',
	engineProvenance: { kind: 'trusted-rule', id: 'pdp-tag-overlap-v1', version: '1' },
	publicationContext: { candidateProductIds: ['p1', 'p2', 'p3'] },
});
assert('registered trusted-rule output publishes inside rules authority', trustedRules.source === 'engine'
	&& trustedRules.engineProvenance?.kind === 'trusted-rule');

const forgedRules = resolveZone({
	zoneId: 'pdp.related',
	brandId: 'bealls',
	routePath: '/product/parity-shirt',
	policy: relatedPolicy,
	engineOutput: { zones: { 'pdp.related': related } },
	engineDecisionMode: 'rules',
	engineProvenance: { kind: 'trusted-rule', id: 'arbitrary-unregistered-rule', version: '999' } as never,
	publicationContext: { candidateProductIds: ['p1', 'p2', 'p3'] },
});
assert('unregistered trusted-rule identity cannot publish into rules authority', forgedRules.source === 'fallback');

const modelOverreach = resolveZone({
	zoneId: 'pdp.related',
	brandId: 'bealls',
	routePath: '/product/parity-shirt',
	policy: relatedPolicy,
	engineOutput: { zones: { 'pdp.related': related } },
	engineDecisionMode: 'model',
	engineProvenance: { kind: 'model', approvedInputHash: 'b'.repeat(64), modelId: 'fixture-model' },
	publicationContext: { candidateProductIds: ['p1', 'p2', 'p3'] },
});
assert('model authority cannot replace a rules-only zone', modelOverreach.source === 'fallback');

const cartPolicy = compileBrandCompositionPolicy('bealls', 'cart', 'cart.above-checkout-cta');
const pin: TrustedMerchantZoneRecord = {
	authority: 'pin',
	contentVersion: 'merchant-v2',
	content: { ...lastChance, props: { ...lastChance.props, title: 'Merchant-pinned order add-ons' } },
	binding: {
		organizationId: cartPolicy.provenance.organizationId,
		brandId: 'bealls',
		routePath: '/cart',
		surface: 'cart',
		zoneId: 'cart.above-checkout-cta',
		policyVersion: cartPolicy.policyVersion,
		referenceState: 'uncontracted',
		referenceId: null,
		referenceVersion: null,
	},
};
const merchantPinned = resolveZone({
	zoneId: 'cart.above-checkout-cta',
	brandId: 'bealls',
	routePath: '/cart',
	policy: cartPolicy,
	adminRecord: pin,
	engineOutput: { zones: { 'cart.above-checkout-cta': lastChance } },
	engineDecisionMode: 'model',
	engineProvenance: { kind: 'model', approvedInputHash: 'c'.repeat(64), modelId: 'fixture-model' },
	publicationContext: { candidateProductIds: ['p1', 'p2', 'p3'] },
});
assert('exactly bound merchant pin precedes otherwise authorized engine output', merchantPinned.source === 'admin'
	&& merchantPinned.merchantAuthority === 'pin'
	&& merchantPinned.merchantContentVersion === 'merchant-v2');

const outsideCatalogPin: TrustedMerchantZoneRecord = {
	...pin,
	contentVersion: 'merchant-outside-catalog-v1',
	content: {
		...lastChance,
		props: { ...lastChance.props, products: [{ productId: 'outside-catalog', role: 'compact' }] },
	},
};
const outsideCatalogRejected = resolveZone({
	zoneId: 'cart.above-checkout-cta', brandId: 'bealls', routePath: '/cart', policy: cartPolicy,
	adminRecord: outsideCatalogPin,
	publicationContext: { candidateProductIds: ['p1', 'p2', 'p3'] },
});
assert('exact merchant locks and pins cannot select outside-catalog products', outsideCatalogRejected.source === 'fallback');

const wrongRoutePin: TrustedMerchantZoneRecord = {
	...pin,
	binding: { ...pin.binding, routePath: '/checkout' },
};
const unboundIgnored = resolveZone({
	zoneId: 'cart.above-checkout-cta',
	brandId: 'bealls',
	routePath: '/cart',
	policy: cartPolicy,
	adminRecord: wrongRoutePin,
	engineOutput: { zones: { 'cart.above-checkout-cta': lastChance } },
	engineDecisionMode: 'model',
	engineProvenance: { kind: 'model', approvedInputHash: 'd'.repeat(64), modelId: 'fixture-model' },
	publicationContext: { candidateProductIds: ['p1', 'p2', 'p3'] },
});
assert('merchant data bound to another route is not authority', unboundIgnored.source === 'fallback');

const homeHeroPolicy = compileBrandCompositionPolicy('bealls', 'home', 'home.hero');
const maliciousHeroLock: TrustedMerchantZoneRecord = {
	authority: 'lock',
	contentVersion: 'merchant-malicious-v1',
	content: {
		component: 'editorial-hero',
		props: {
			image: 'https://attacker.example/tracker.gif',
			headline: 'Untrusted destination',
			ctaLabel: 'Leave store',
			ctaHref: 'https://attacker.example/phish',
			textPosition: 'left',
		},
	},
	binding: {
		organizationId: homeHeroPolicy.provenance.organizationId,
		brandId: 'bealls',
		routePath: '/',
		surface: 'home',
		zoneId: 'home.hero',
		policyVersion: homeHeroPolicy.policyVersion,
		referenceState: 'uncontracted',
		referenceId: null,
		referenceVersion: null,
	},
};
const maliciousHeroRejected = resolveHomeHero({ adminRecord: maliciousHeroLock });
assert('exact merchant locks still cannot invent external assets or destinations',
	maliciousHeroRejected.source === 'fallback'
	&& JSON.stringify(maliciousHeroRejected.content).includes('attacker.example') === false);

const tooManyArrayItems = resolveZone({
	zoneId: 'cart.below-fold',
	brandId: 'bealls',
	routePath: '/cart',
	policy: compileBrandCompositionPolicy('bealls', 'cart', 'cart.below-fold'),
	engineOutput: { zones: { 'cart.below-fold': [lastChance, lastChance, lastChance] } },
	engineDecisionMode: 'model',
	engineProvenance: { kind: 'model', approvedInputHash: 'e'.repeat(64), modelId: 'fixture-model' },
});
assert('zone multiplicity bound rejects oversized arrays', tooManyArrayItems.source === 'fallback'
	&& tooManyArrayItems.terminal === 'hidden');

if (failures) throw new Error(`${failures} zone authority test(s) failed`);

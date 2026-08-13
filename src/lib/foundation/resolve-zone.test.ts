/**
 * Zone resolver — three-source cascade precedence tests.
 *
 * Run: npx tsx src/lib/foundation/resolve-zone.test.ts
 *
 * Covers:
 * - Cascade precedence: engine > admin > fallback
 * - Schema validation: invalid content is rejected, cascade continues
 * - Multiplicity: singleton, indexed, array
 * - Hidden semantic: fallback returning null is a valid resolution
 * - Catalog integrity: every zone schema validates against its registry entry
 * - Instance ID parsing: indexed instances resolve to correct family + index
 */

import { resolveZone } from './resolve-zone';
import { ZONES, parseZoneInstance, enumerateZoneInstances, ZONE_IDS } from './zones';
import { ZoneSchemas } from './zone-schemas';

let passed = 0;
let failed = 0;
function assert(name: string, condition: boolean, detail = '') {
	if (condition) {
		console.log(`  PASS  ${name}`);
		passed++;
	} else {
		console.error(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
		failed++;
	}
}

// Valid content fixtures (used across multiple tests)

const heroEditorial = {
	component: 'editorial-header',
	props: { eyebrow: 'NEW SEASON', headline: 'Spring 2026', body: 'Fresh picks.' },
};

const heroFromAdmin = {
	component: 'editorial-header',
	props: { eyebrow: 'AUTHORED', headline: 'Merchant pick', body: 'Hand-picked.' },
};

const productCarousel = {
	component: 'product-carousel',
	props: { title: 'Best Sellers', products: [
		{ productId: 'p1', role: 'standard' },
		{ productId: 'p2', role: 'standard' },
		{ productId: 'p3', role: 'standard' },
	] },
};

const cartBelowFoldItem = {
	component: 'bealls-bucks-callout',
	props: { mode: 'earn', amount: 5, unit: 'Bealls Bucks' },
};

// ─── Cascade precedence ─────────────────────────────────────────────

console.log('\nCascade precedence: engine > admin > fallback');

{
	const r = resolveZone({
		zoneId: 'home.hero',
		brandId: 'bealls',
		engineOutput: { zones: { 'home.hero': heroEditorial } },
		adminContent: { zones: { 'home.hero': heroFromAdmin } },
	});
	assert('engine wins when both engine + admin present', r.source === 'engine');
	assert('engine content matches input', JSON.stringify(r.content) === JSON.stringify(heroEditorial));
}

{
	const r = resolveZone({
		zoneId: 'home.hero',
		brandId: 'bealls',
		adminContent: { zones: { 'home.hero': heroFromAdmin } },
	});
	assert('admin wins when no engine output', r.source === 'admin');
	assert('admin content matches input', JSON.stringify(r.content) === JSON.stringify(heroFromAdmin));
}

{
	const r = resolveZone({ zoneId: 'home.hero', brandId: 'bealls' });
	assert('fallback fires when neither engine nor admin', r.source === 'fallback');
	assert('home.hero fallback returns brand-aware editorial-header content',
		!!r.content && (r.content as { component?: string }).component === 'editorial-header');
}

{
	// Zones without a registered fallback resolve to null (Hidden) — sanity
	// check that the cascade still produces "fallback" + null when nothing
	// is registered. home.featured-row is intentionally left Hidden.
	const r = resolveZone({ zoneId: 'home.featured-row', brandId: 'bealls' });
	assert('zones with no registered fallback resolve to source=fallback, content=null',
		r.source === 'fallback' && r.content === null);
}

{
	// Brand awareness — bealls and beallsflorida should produce different copy.
	const bealls = resolveZone({ zoneId: 'home.hero', brandId: 'bealls' });
	const florida = resolveZone({ zoneId: 'home.hero', brandId: 'beallsflorida' });
	const beallsHeadline = (bealls.content as { props: { headline: string } }).props.headline;
	const floridaHeadline = (florida.content as { props: { headline: string } }).props.headline;
	assert('home.hero fallback differs by brand (brand-aware)', beallsHeadline !== floridaHeadline);
}

{
	// Unknown brand should not crash — fallback returns null defensively.
	const r = resolveZone({ zoneId: 'home.hero', brandId: 'not-a-brand' });
	assert('unknown brandId resolves to source=fallback, content=null',
		r.source === 'fallback' && r.content === null);
}

// ─── Schema validation rejects invalid content; cascade continues ──

console.log('\nSchema validation rejects invalid content');

{
	const r = resolveZone({
		zoneId: 'home.hero',
		brandId: 'bealls',
		engineOutput: { zones: { 'home.hero': { component: 'product-grid', props: {} } } }, // wrong block for hero
		adminContent: { zones: { 'home.hero': heroFromAdmin } },
	});
	assert('invalid engine content is rejected, cascade falls through to admin', r.source === 'admin');
}

{
	const r = resolveZone({
		zoneId: 'home.hero',
		brandId: 'bealls',
		engineOutput: { zones: { 'home.hero': { component: 'editorial-header' } } }, // missing props
	});
	assert('engine content missing props falls through to fallback', r.source === 'fallback');
}

// ─── Engine-locked zones ignore admin content if engine omits ───────

console.log('\nZone metadata gates which sources can populate');

{
	// pdp.recently-viewed is engineComposable: true, adminAuthorable: false
	const r = resolveZone({
		zoneId: 'pdp.recently-viewed',
		brandId: 'bealls',
		adminContent: { zones: { 'pdp.recently-viewed': {
			component: 'recently-viewed', props: { items: [] },
		} } },
	});
	assert('admin-disabled zone ignores admin content even if present', r.source === 'fallback');
}

{
	// plp.below-grid is engineComposable: false, adminAuthorable: true
	const r = resolveZone({
		zoneId: 'plp.below-grid',
		brandId: 'bealls',
		engineOutput: { zones: { 'plp.below-grid': { component: 'pagination', props: {} } } },
	});
	assert('engine-disabled zone ignores engine content even if present', r.source === 'fallback');
}

// ─── Indexed zones ──────────────────────────────────────────────────

console.log('\nIndexed zones resolve through family schema + index');

{
	const r = resolveZone({
		zoneId: 'home.featured-row.1',
		brandId: 'bealls',
		engineOutput: { zones: { 'home.featured-row.1': productCarousel } },
	});
	assert('indexed instance resolves with engine content', r.source === 'engine');
	assert('parsed family is correct', r.family === 'home.featured-row');
	assert('parsed index is correct', r.index === 1);
}

{
	const r = resolveZone({
		zoneId: 'home.featured-row.6',
		brandId: 'bealls',
		engineOutput: { zones: { 'home.featured-row.6': productCarousel } },
	});
	assert('max-index instance accepted', r.source === 'engine' && r.index === 6);
}

{
	let threw = false;
	try {
		resolveZone({ zoneId: 'home.featured-row.7', brandId: 'bealls' });
	} catch {
		threw = true;
	}
	assert('out-of-range index throws (catalog max is 6)', threw);
}

// ─── Array zones ────────────────────────────────────────────────────

console.log('\nArray zones validate each item independently');

{
	const r = resolveZone({
		zoneId: 'cart.below-fold',
		brandId: 'bealls',
		engineOutput: { zones: { 'cart.below-fold': [cartBelowFoldItem, cartBelowFoldItem] } },
	});
	assert('array zone accepts list of valid items', r.source === 'engine');
	assert('array content is preserved as array', Array.isArray(r.content) && (r.content as unknown[]).length === 2);
}

{
	const r = resolveZone({
		zoneId: 'cart.below-fold',
		brandId: 'bealls',
		engineOutput: { zones: { 'cart.below-fold': [cartBelowFoldItem, cartBelowFoldItem, cartBelowFoldItem] } }, // exceeds maxItems: 2
	});
	assert('array exceeding maxItems falls through', r.source === 'fallback');
}

{
	const r = resolveZone({
		zoneId: 'cart.below-fold',
		brandId: 'bealls',
		engineOutput: { zones: { 'cart.below-fold': cartBelowFoldItem } }, // not an array
	});
	assert('non-array content for array zone falls through', r.source === 'fallback');
}

// ─── Catalog integrity ──────────────────────────────────────────────

console.log('\nCatalog integrity');

{
	let allMatched = true;
	for (const zoneId of ZONE_IDS) {
		if (!(zoneId in ZoneSchemas)) {
			console.error(`    missing schema for ${zoneId}`);
			allMatched = false;
		}
	}
	assert('every zone in registry has a corresponding schema', allMatched);
}

{
	let allMatched = true;
	for (const zoneId of Object.keys(ZoneSchemas)) {
		if (!(zoneId in ZONES)) {
			console.error(`    schema declared for unknown zone ${zoneId}`);
			allMatched = false;
		}
	}
	assert('every schema corresponds to a registered zone', allMatched);
}

{
	const instances = enumerateZoneInstances();
	// 27 family entries — but indexed zones expand: home.featured-row (6) and account.dashboard-pick (4)
	// gives 27 - 2 + 6 + 4 = 35 instances total
	const expected = ZONE_IDS.length + (6 - 1) + (4 - 1); // each indexed family contributes (maxIndex - 1) extra
	assert(`enumerateZoneInstances returns ${expected} instances`, instances.length === expected,
		`got ${instances.length}`);

	let allParsable = true;
	for (const id of instances) {
		if (parseZoneInstance(id) === null) {
			console.error(`    unparsable instance ${id}`);
			allParsable = false;
		}
	}
	assert('every enumerated instance parses back to a valid zone', allParsable);
}

// ─── Unknown zone IDs ───────────────────────────────────────────────

console.log('\nUnknown zone IDs');

{
	let threw = false;
	try {
		resolveZone({ zoneId: 'home.does-not-exist', brandId: 'bealls' });
	} catch {
		threw = true;
	}
	assert('unknown zone ID throws', threw);
}

// ─── PDP Slice 2 — zones populated by Slice 2 ─────────────────────

console.log('\nPDP Slice 2 zones');

const pdpProductCarousel = {
	component: 'product-carousel',
	props: { title: 'You might also like', products: [
		{ productId: 'p1', role: 'standard' },
		{ productId: 'p2', role: 'standard' },
		{ productId: 'p3', role: 'standard' },
	] },
};

{
	const r = resolveZone({
		zoneId: 'pdp.related',
		brandId: 'bealls',
		engineOutput: { zones: { 'pdp.related': pdpProductCarousel } },
	});
	assert('pdp.related accepts product-carousel from engine', r.source === 'engine');
}

{
	const r = resolveZone({
		zoneId: 'pdp.cross-sell',
		brandId: 'bealls',
		engineOutput: { zones: { 'pdp.cross-sell': pdpProductCarousel } },
	});
	assert('pdp.cross-sell accepts product-carousel from engine', r.source === 'engine');
}

{
	const r = resolveZone({
		zoneId: 'pdp.recently-viewed',
		brandId: 'bealls',
		engineOutput: { zones: { 'pdp.recently-viewed': pdpProductCarousel } },
	});
	assert('pdp.recently-viewed accepts product-carousel from engine', r.source === 'engine');
}

{
	const r = resolveZone({
		zoneId: 'pdp.below-recs',
		brandId: 'bealls',
	});
	const c = r.content as { component?: string; props?: { stores?: unknown[] } } | null;
	assert(
		'pdp.below-recs storefront fallback returns bopis-picker block',
		r.source === 'fallback' && !!c && c.component === 'bopis-picker',
	);
	assert(
		'pdp.below-recs storefront fallback has empty stores array (placeholder)',
		!!c?.props && Array.isArray(c.props.stores) && c.props.stores.length === 0,
	);
}

{
	const bopisPickerEngine = {
		component: 'bopis-picker',
		props: {
			zip: '34229',
			stores: [
				{ id: 's1', name: 'Bealls Sarasota', address: '123 Tamiami Trail', hours: 'Open 10am–9pm', pickupReady: true },
			],
			productName: 'Linen blouse',
		},
	};
	const r = resolveZone({
		zoneId: 'pdp.below-recs',
		brandId: 'bealls',
		engineOutput: { zones: { 'pdp.below-recs': bopisPickerEngine } },
	});
	assert('pdp.below-recs accepts bopis-picker from engine', r.source === 'engine');
}

// ─── Phase 3 cart specialization ───────────────────────────────────

console.log('\nCart specialization (Phase 3)');

const lastChanceUpsellRow = {
	component: 'last-chance-upsell-row',
	props: {
		title: 'Last chance — pair these with your order',
		products: [
			{ productId: 'p1', role: 'compact' },
			{ productId: 'p2', role: 'compact' },
			{ productId: 'p3', role: 'compact' },
		],
	},
};

{
	const r = resolveZone({
		zoneId: 'cart.above-checkout-cta',
		brandId: 'bealls',
		engineOutput: { zones: { 'cart.above-checkout-cta': lastChanceUpsellRow } },
	});
	assert('cart.above-checkout-cta accepts last-chance-upsell-row from engine', r.source === 'engine');
}

{
	// Coupon-strip is the other valid block at cart.above-checkout-cta per ADR-007.
	const couponStrip = {
		component: 'coupon-strip',
		props: {
			eyebrow: 'OFFER',
			headline: 'Get $10 off when you spend $80+',
			ctaLabel: 'Get Code',
		},
	};
	const r = resolveZone({
		zoneId: 'cart.above-checkout-cta',
		brandId: 'bealls',
		engineOutput: { zones: { 'cart.above-checkout-cta': couponStrip } },
	});
	assert('cart.above-checkout-cta accepts coupon-strip alternative', r.source === 'engine');
}

{
	// Reject content from a block not in the cart.above-checkout-cta union.
	const r = resolveZone({
		zoneId: 'cart.above-checkout-cta',
		brandId: 'bealls',
		engineOutput: { zones: { 'cart.above-checkout-cta': {
			component: 'editorial-hero',
			props: { image: 'x', headline: 'Spring 2026', textPosition: 'center' },
		} } },
	});
	assert('cart.above-checkout-cta rejects out-of-vocabulary block (editorial-hero)', r.source === 'fallback');
}

{
	const r = resolveZone({ zoneId: 'cart.above-checkout-cta', brandId: 'bealls' });
	assert(
		'cart.above-checkout-cta has Hidden default fallback',
		r.source === 'fallback' && r.content === null,
	);
}

// ─── Phase 3 checkout specialization ───────────────────────────────

console.log('\nCheckout specialization (Phase 3)');

const assuranceStrip = {
	component: 'assurance-strip-checkout',
	props: {
		variant: 'first-time',
		items: [
			{ icon: '🔒', label: 'Secure checkout', body: 'PCI-compliant.' },
			{ icon: '↩︎', label: 'Easy returns', body: 'Within 60 days.' },
			{ icon: '🚚', label: 'Free shipping', body: 'On qualifying orders.' },
		],
	},
};

{
	const r = resolveZone({
		zoneId: 'checkout.assurance-strip',
		brandId: 'bealls',
		engineOutput: { zones: { 'checkout.assurance-strip': assuranceStrip } },
	});
	assert('checkout.assurance-strip accepts engine variant', r.source === 'engine');
}

{
	const r = resolveZone({ zoneId: 'checkout.assurance-strip', brandId: 'bealls' });
	const c = r.content as { component?: string; props?: { variant?: string; items?: unknown[] } } | null;
	assert(
		'checkout.assurance-strip falls back to brand-default trust strip',
		r.source === 'fallback'
			&& !!c
			&& c.component === 'assurance-strip-checkout'
			&& c.props?.variant === 'first-time'
			&& Array.isArray(c.props?.items)
			&& (c.props?.items?.length ?? 0) >= 3,
	);
}

{
	const r = resolveZone({
		zoneId: 'checkout.last-chance-upsell',
		brandId: 'bealls',
		engineOutput: { zones: { 'checkout.last-chance-upsell': lastChanceUpsellRow } },
	});
	assert('checkout.last-chance-upsell accepts last-chance-upsell-row from engine', r.source === 'engine');
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);

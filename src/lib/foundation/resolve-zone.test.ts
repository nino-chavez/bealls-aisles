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
		brandId: 'haven',
		engineOutput: { zones: { 'home.hero': heroEditorial } },
		adminContent: { zones: { 'home.hero': heroFromAdmin } },
	});
	assert('engine wins when both engine + admin present', r.source === 'engine');
	assert('engine content matches input', JSON.stringify(r.content) === JSON.stringify(heroEditorial));
}

{
	const r = resolveZone({
		zoneId: 'home.hero',
		brandId: 'haven',
		adminContent: { zones: { 'home.hero': heroFromAdmin } },
	});
	assert('admin wins when no engine output', r.source === 'admin');
	assert('admin content matches input', JSON.stringify(r.content) === JSON.stringify(heroFromAdmin));
}

{
	const r = resolveZone({ zoneId: 'home.hero', brandId: 'haven' });
	assert('fallback fires when neither engine nor admin', r.source === 'fallback');
	assert('Phase 2 Session A fallback is null (Hidden)', r.content === null);
}

// ─── Schema validation rejects invalid content; cascade continues ──

console.log('\nSchema validation rejects invalid content');

{
	const r = resolveZone({
		zoneId: 'home.hero',
		brandId: 'haven',
		engineOutput: { zones: { 'home.hero': { component: 'product-grid', props: {} } } }, // wrong block for hero
		adminContent: { zones: { 'home.hero': heroFromAdmin } },
	});
	assert('invalid engine content is rejected, cascade falls through to admin', r.source === 'admin');
}

{
	const r = resolveZone({
		zoneId: 'home.hero',
		brandId: 'haven',
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
		brandId: 'haven',
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
		brandId: 'haven',
		engineOutput: { zones: { 'plp.below-grid': { component: 'pagination', props: {} } } },
	});
	assert('engine-disabled zone ignores engine content even if present', r.source === 'fallback');
}

// ─── Indexed zones ──────────────────────────────────────────────────

console.log('\nIndexed zones resolve through family schema + index');

{
	const r = resolveZone({
		zoneId: 'home.featured-row.1',
		brandId: 'haven',
		engineOutput: { zones: { 'home.featured-row.1': productCarousel } },
	});
	assert('indexed instance resolves with engine content', r.source === 'engine');
	assert('parsed family is correct', r.family === 'home.featured-row');
	assert('parsed index is correct', r.index === 1);
}

{
	const r = resolveZone({
		zoneId: 'home.featured-row.6',
		brandId: 'haven',
		engineOutput: { zones: { 'home.featured-row.6': productCarousel } },
	});
	assert('max-index instance accepted', r.source === 'engine' && r.index === 6);
}

{
	let threw = false;
	try {
		resolveZone({ zoneId: 'home.featured-row.7', brandId: 'haven' });
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
		brandId: 'haven',
		engineOutput: { zones: { 'cart.below-fold': [cartBelowFoldItem, cartBelowFoldItem] } },
	});
	assert('array zone accepts list of valid items', r.source === 'engine');
	assert('array content is preserved as array', Array.isArray(r.content) && (r.content as unknown[]).length === 2);
}

{
	const r = resolveZone({
		zoneId: 'cart.below-fold',
		brandId: 'haven',
		engineOutput: { zones: { 'cart.below-fold': [cartBelowFoldItem, cartBelowFoldItem, cartBelowFoldItem] } }, // exceeds maxItems: 2
	});
	assert('array exceeding maxItems falls through', r.source === 'fallback');
}

{
	const r = resolveZone({
		zoneId: 'cart.below-fold',
		brandId: 'haven',
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
		resolveZone({ zoneId: 'home.does-not-exist', brandId: 'haven' });
	} catch {
		threw = true;
	}
	assert('unknown zone ID throws', threw);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);

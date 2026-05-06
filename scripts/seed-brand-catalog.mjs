/**
 * Brand-scoped BigCommerce catalog seeder.
 *
 * Replaces the old setup-catalog.mjs which did a destructive deleteAllProducts
 * before recreating. That was unsafe on a multi-brand store: re-running for any
 * one brand would wipe every other brand's catalog.
 *
 * This seeder:
 *   - Reads a fixture JSON describing one brand's catalog
 *   - Deletes ONLY products whose categories live under the brand's prefix path
 *   - Hard-aborts if any product about to be deleted has a category outside
 *     the brand prefix (cross-brand contamination guard)
 *   - Recreates the brand's categories + products idempotently
 *
 * Fixture shape:
 *   {
 *     "brand": "sleepcountry",
 *     "categoryPrefix": "SleepCountry",
 *     "categories": [{ "name": "Mattresses", "description": "...", "sort_order": 1 }, ...],
 *     "products": [{ "name": "...", "sku": "SC-MAT-001", "price": 1499, "category": "Mattresses", ... }, ...]
 *   }
 *
 * Usage:
 *   node scripts/seed-brand-catalog.mjs --brand sleepcountry [--dry-run]
 *
 * Reads BC creds from env (see ENV_PREFIX_BY_BRAND below). Defaults can be
 * overridden via --store-hash, --client-id, --access-token flags.
 */

import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load both .env and .env.local; later wins. The deployment work uses
// .env.local (gitignored) for live BC creds.
loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Maps brand id → env-var prefix where its BC creds live in `.env.local`.
// Bealls/BF/HC share the cdfqf9k6zf creds (no prefix). New brands point at
// their own creds via prefixed env vars.
const ENV_PREFIX_BY_BRAND = {
	sleepcountry: 'SLEEPCOUNTRY_',
	bealls: '',
	beallsflorida: '',
	homecentric: '',
};

// ─── Args ─────────────────────────────────────────────────────────────

function parseArgs(argv) {
	const args = { brand: null, dryRun: false, fixture: null, storeHash: null, clientId: null, accessToken: null };
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--brand') args.brand = argv[++i];
		else if (a === '--fixture') args.fixture = argv[++i];
		else if (a === '--dry-run') args.dryRun = true;
		else if (a === '--store-hash') args.storeHash = argv[++i];
		else if (a === '--client-id') args.clientId = argv[++i];
		else if (a === '--access-token') args.accessToken = argv[++i];
		else if (a === '--help' || a === '-h') {
			console.log('Usage: node scripts/seed-brand-catalog.mjs --brand <id> [--dry-run]');
			process.exit(0);
		}
	}
	if (!args.brand) {
		console.error('error: --brand is required');
		process.exit(2);
	}
	return args;
}

const args = parseArgs(process.argv);
const envPrefix = ENV_PREFIX_BY_BRAND[args.brand] ?? '';
const STORE = args.storeHash ?? process.env[`${envPrefix}BIGCOMMERCE_STORE_HASH`];
const CLIENT_ID = args.clientId ?? process.env[`${envPrefix}BIGCOMMERCE_CLIENT_ID`];
const TOKEN = args.accessToken ?? process.env[`${envPrefix}BIGCOMMERCE_ACCESS_TOKEN`];

if (!STORE || !TOKEN) {
	console.error(`error: missing BC creds. Expected env vars ${envPrefix}BIGCOMMERCE_STORE_HASH and ${envPrefix}BIGCOMMERCE_ACCESS_TOKEN.`);
	process.exit(2);
}

const BASE = `https://api.bigcommerce.com/stores/${STORE}/v3`;
const headers = { 'X-Auth-Token': TOKEN, 'Content-Type': 'application/json', Accept: 'application/json' };
if (CLIENT_ID) headers['X-Auth-Client'] = CLIENT_ID;

// ─── Fixture ──────────────────────────────────────────────────────────

const fixturePath = args.fixture ?? path.join(__dirname, 'fixtures', `${args.brand}-catalog.json`);
if (!fs.existsSync(fixturePath)) {
	console.error(`error: fixture not found at ${fixturePath}`);
	process.exit(2);
}
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

if (fixture.brand !== args.brand) {
	console.error(`error: fixture.brand (${fixture.brand}) does not match --brand (${args.brand}). Refusing to proceed.`);
	process.exit(2);
}
if (!fixture.categoryPrefix || typeof fixture.categoryPrefix !== 'string') {
	console.error('error: fixture.categoryPrefix is required (e.g., "SleepCountry").');
	process.exit(2);
}

const PREFIX = fixture.categoryPrefix;
// channelId and treeId tell the seeder which storefront to make products visible
// on. Default treeId=1 = the BC default catalog tree; override per-brand if the
// brand has its own tree. channelId default is also 1 (Demo channel).
const CHANNEL_ID = fixture.channelId ?? 1;
const TREE_ID = fixture.treeId ?? 1;

console.log(`Brand-scoped seeder`);
console.log(`  Brand:          ${fixture.brand}`);
console.log(`  Store:          ${STORE}`);
console.log(`  CategoryPrefix: ${PREFIX}/`);
console.log(`  Mode:           ${args.dryRun ? 'DRY-RUN (no writes)' : 'EXECUTE (writes to BC)'}`);
console.log(`  Fixture:        ${fixturePath}`);
console.log('');

// ─── HTTP ─────────────────────────────────────────────────────────────

async function api(method, path, body) {
	const url = `${BASE}${path}`;
	const opts = { method, headers };
	if (body) opts.body = JSON.stringify(body);

	const res = await fetch(url, opts);

	if (res.status === 429) {
		const retry = parseInt(res.headers.get('X-Rate-Limit-Time-Reset-Ms') || '1000');
		console.log(`  Rate limited, waiting ${retry}ms...`);
		await new Promise((r) => setTimeout(r, retry + 100));
		return api(method, path, body);
	}

	if (res.status === 204) return null;

	const text = await res.text();
	let data = null;
	try { data = JSON.parse(text); } catch { data = { raw: text }; }
	if (!res.ok) {
		console.error(`  API ${method} ${path} → ${res.status}`);
		console.error(`  ${JSON.stringify(data, null, 2).slice(0, 800)}`);
		throw new Error(`API ${method} ${path} failed: ${res.status}`);
	}
	return data;
}

async function apiPaged(path) {
	const out = [];
	let page = 1;
	while (true) {
		const sep = path.includes('?') ? '&' : '?';
		const res = await api('GET', `${path}${sep}limit=250&page=${page}`);
		if (!res?.data || res.data.length === 0) break;
		out.push(...res.data);
		const total = res.meta?.pagination?.total_pages ?? 1;
		if (page >= total) break;
		page++;
	}
	return out;
}

// ─── Brand-scoped destructive ops ─────────────────────────────────────

async function listBrandCategories() {
	const all = await apiPaged('/catalog/categories?limit=250');
	const own = all.filter((c) => c.name === PREFIX || c.name.startsWith(`${PREFIX} `) || c.name.startsWith(`${PREFIX}/`));
	return { all, own };
}

async function deleteBrandProducts(brandCategoryIds) {
	if (brandCategoryIds.length === 0) {
		console.log('  No brand categories — nothing to delete.');
		return;
	}

	// Pull every product that has at least one of our brand's categories.
	// Include `categories` field so we can verify cross-brand purity inline.
	const candidates = await apiPaged(
		`/catalog/products?categories:in=${brandCategoryIds.join(',')}&include_fields=name,sku,categories`,
	);
	if (candidates.length === 0) {
		console.log('  No existing brand products to delete.');
		return;
	}

	// SAFETY GUARD: every candidate's categories must be a subset of brand categories.
	// If any product also belongs to a non-brand category, abort — we don't know
	// whether deleting it would break another brand.
	const brandCatSet = new Set(brandCategoryIds);
	const violators = [];
	for (const p of candidates) {
		const foreign = (p.categories || []).filter((id) => !brandCatSet.has(id));
		if (foreign.length > 0) violators.push({ id: p.id, name: p.name, sku: p.sku, foreignCategoryIds: foreign });
	}

	if (violators.length > 0) {
		console.error('');
		console.error('  ABORT: cross-brand contamination detected.');
		console.error(`  ${violators.length} product(s) under ${PREFIX}/ also live in non-${PREFIX} categories.`);
		console.error('  Refusing to delete — risk of touching another brand\'s catalog.');
		console.error('  Violators:');
		for (const v of violators.slice(0, 10)) {
			console.error(`    - "${v.name}" (sku=${v.sku}, id=${v.id}) → foreign category ids: ${v.foreignCategoryIds.join(',')}`);
		}
		if (violators.length > 10) console.error(`    ... and ${violators.length - 10} more`);
		process.exit(3);
	}

	if (args.dryRun) {
		console.log(`  [DRY-RUN] Would delete ${candidates.length} ${PREFIX} products:`);
		for (const p of candidates.slice(0, 8)) console.log(`    - ${p.name} (sku=${p.sku})`);
		if (candidates.length > 8) console.log(`    ... and ${candidates.length - 8} more`);
		return;
	}

	const ids = candidates.map((p) => p.id);
	const chunks = [];
	for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
	for (const chunk of chunks) {
		await api('DELETE', `/catalog/products?id:in=${chunk.join(',')}`);
	}
	console.log(`  Deleted ${ids.length} ${PREFIX} products.`);
}

async function deleteBrandCategories(brandCategoryIds) {
	if (brandCategoryIds.length === 0) return;
	if (args.dryRun) {
		console.log(`  [DRY-RUN] Would delete ${brandCategoryIds.length} ${PREFIX} categories.`);
		return;
	}
	for (const id of brandCategoryIds) {
		try {
			await api('DELETE', `/catalog/categories/${id}`);
		} catch (e) {
			console.warn(`  warn: could not delete category ${id} — ${e.message}`);
		}
	}
	console.log(`  Deleted ${brandCategoryIds.length} ${PREFIX} categories.`);
}

// ─── Create ───────────────────────────────────────────────────────────

async function createCategories() {
	const created = {};
	for (const cat of fixture.categories) {
		const name = `${PREFIX} ${cat.name}`;
		if (args.dryRun) {
			console.log(`  [DRY-RUN] Would create category: ${name} (tree ${TREE_ID})`);
			created[cat.name] = -1;
			continue;
		}
		const res = await api('POST', '/catalog/categories', {
			name,
			description: cat.description ?? '',
			sort_order: cat.sort_order ?? 0,
			is_visible: true,
			parent_id: 0,
		});
		created[cat.name] = res.data.id;
		console.log(`  Created category: ${name} [id=${res.data.id}]`);
	}

	// Categories created via legacy POST /catalog/categories are not assigned
	// to a tree. The Demo channel + storefront API only sees products in
	// categories that belong to the channel's tree. Assign explicitly.
	if (!args.dryRun && Object.values(created).length > 0) {
		const body = Object.values(created)
			.filter((id) => id > 0)
			.map((id) => ({ category_id: id, tree_id: TREE_ID }));
		await api('PUT', '/catalog/trees/categories',
			Object.entries(created).map(([brandCatName, id]) => ({
				category_id: id,
				tree_id: TREE_ID,
				name: `${PREFIX} ${brandCatName}`,
				parent_id: 0,
				is_visible: true,
			})),
		);
		console.log(`  Assigned ${body.length} categories to tree ${TREE_ID}.`);
	}

	return created;
}

async function createProducts(categoryIdMap) {
	let n = 0;
	for (const p of fixture.products) {
		// Defensive: every product SKU must include the brand's SKU prefix
		// to make it visually obvious in the BC admin which brand owns it.
		if (fixture.skuPrefix && !p.sku.startsWith(fixture.skuPrefix)) {
			console.error(`  ABORT: product SKU "${p.sku}" does not start with skuPrefix "${fixture.skuPrefix}". Fixture is malformed.`);
			process.exit(3);
		}

		const categoryId = categoryIdMap[p.category];
		if (!categoryId) {
			console.error(`  ABORT: product "${p.name}" references category "${p.category}" which is not in fixture.categories.`);
			process.exit(3);
		}

		const body = {
			name: p.name,
			type: p.type ?? 'physical',
			weight: p.weight ?? 1,
			price: p.price,
			...(p.sale_price ? { sale_price: p.sale_price } : {}),
			categories: [categoryId],
			description: p.description ?? '',
			sku: p.sku,
			is_visible: true,
			...(p.brand ? { brand_name: p.brand } : {}),
			...(p.images ? { images: p.images } : {}),
			...(p.custom_fields ? { custom_fields: p.custom_fields } : {}),
		};

		if (args.dryRun) {
			console.log(`  [DRY-RUN] Would create: ${p.name} (sku=${p.sku}, $${p.price})`);
			n++;
			continue;
		}

		const res = await api('POST', '/catalog/products', body);
		n++;
		console.log(`  [${n}/${fixture.products.length}] ${p.name} (sku=${p.sku}, $${p.price}) → id=${res.data.id}`);
		createdProductIds.push(res.data.id);
	}
	console.log(`  Created ${n} ${PREFIX} products.`);
}

// Module-level so createProducts and assignProductsToChannel share the list.
const createdProductIds = [];

async function assignProductsToChannel() {
	if (args.dryRun) {
		console.log(`  [DRY-RUN] Would assign ${createdProductIds.length} products to channel ${CHANNEL_ID}.`);
		return;
	}
	if (createdProductIds.length === 0) return;
	const body = createdProductIds.map((id) => ({ product_id: id, channel_id: CHANNEL_ID }));
	const chunks = [];
	for (let i = 0; i < body.length; i += 50) chunks.push(body.slice(i, i + 50));
	for (const chunk of chunks) {
		await api('PUT', '/catalog/products/channel-assignments', chunk);
	}
	console.log(`  Assigned ${createdProductIds.length} products to channel ${CHANNEL_ID}.`);
}

// ─── Run ──────────────────────────────────────────────────────────────

async function main() {
	console.log('Step 1: enumerate existing brand categories');
	const { own } = await listBrandCategories();
	const brandCategoryIds = own.map((c) => c.id);
	console.log(`  Found ${brandCategoryIds.length} existing categories under "${PREFIX}".`);

	console.log('\nStep 2: brand-scoped product purge (with cross-brand guard)');
	await deleteBrandProducts(brandCategoryIds);

	console.log('\nStep 3: brand-scoped category purge');
	await deleteBrandCategories(brandCategoryIds);

	console.log('\nStep 4: create brand categories');
	const categoryIdMap = await createCategories();

	console.log('\nStep 5: create brand products');
	await createProducts(categoryIdMap);

	console.log(`\nStep 6: assign products to channel ${CHANNEL_ID}`);
	await assignProductsToChannel();

	console.log('\nDone.');
	if (args.dryRun) console.log('(dry-run — no changes were committed)');
}

main().catch((err) => {
	console.error('\nFATAL:', err.message);
	process.exit(1);
});

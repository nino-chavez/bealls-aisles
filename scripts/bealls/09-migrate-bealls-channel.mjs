#!/usr/bin/env node
/**
 * Migrate the 1,449 bealls products from channel 1 (legacy default Stencil)
 * to channel 1846324 (formerly Ember, now repurposed as bealls headless).
 *
 * No reseed — products keep their BC IDs, images, and attributes. Only
 * channel/category assignments and channel/tree names change.
 *
 * Steps:
 *   1. Wipe tree 6's 4 Ember categories (240-243)
 *   2. Create 8 new "Bealls X" categories on tree 6 → get fresh IDs
 *   3. Build old→new category map (by name match)
 *   4. PATCH each of 1,449 products to repoint categories[]
 *   5. Add channel 1846324 assignment (bulk)
 *   6. Remove channel 1 assignment (bulk)
 *   7. Wipe tree 1's now-empty Bealls categories (250-257)
 *   8. Rename channel 1846324 "Ember" → "bealls", tree 6 → "bealls Catalog"
 *   9. Restore channel 1 name "Demo", tree 1 → "Default catalog tree"
 */
import 'dotenv/config';

const STORE = process.env.BIGCOMMERCE_STORE_HASH;
const TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;
const BASE = `https://api.bigcommerce.com/stores/${STORE}/v3`;
const headers = { 'X-Auth-Token': TOKEN, 'Content-Type': 'application/json', Accept: 'application/json' };

const BEALLS_CATEGORY_NAMES = ['Women', 'Men', 'Kids', 'Shoes', 'Home', 'Beauty', 'Handbags', 'Accessories'];
const OLD_CHANNEL_ID = 1;
const NEW_CHANNEL_ID = 1846324;
const OLD_TREE_ID = 1;
const NEW_TREE_ID = 6;

async function api(method, path, body) {
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});
	if (res.status === 429) {
		const wait = parseInt(res.headers.get('X-Rate-Limit-Time-Reset-Ms') || '1000');
		await new Promise((r) => setTimeout(r, wait + 100));
		return api(method, path, body);
	}
	if (res.status === 204) return null;
	const data = await res.json().catch(() => null);
	if (!res.ok) {
		throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data?.errors || data || {}).slice(0, 200)}`);
	}
	return data;
}

async function mapConc(items, fn, c = 5) {
	const results = new Array(items.length);
	let cursor = 0, done = 0, inFlight = 0;
	return new Promise((resolve) => {
		const next = () => {
			while (inFlight < c && cursor < items.length) {
				const i = cursor++;
				inFlight++;
				Promise.resolve(fn(items[i], i))
					.then((v) => { results[i] = { ok: true, value: v }; })
					.catch((e) => { results[i] = { ok: false, error: e.message, item: items[i] }; })
					.finally(() => {
						inFlight--; done++;
						if (done % 100 === 0) process.stderr.write(`\r    ${done}/${items.length}`);
						if (done === items.length) {
							process.stderr.write(`\r    ${done}/${items.length}\n`);
							resolve(results);
						} else next();
					});
			}
		};
		next();
	});
}

console.log('\n=== Bealls channel migration ===\n');

// ─── 1. Wipe Ember + any pre-existing Bealls cats from tree 6 (idempotent) ──
console.log('1. Wiping non-target categories from tree 6...');
const tree6Before = await api('GET', `/catalog/trees/${NEW_TREE_ID}/categories`);
const wipeIds = (tree6Before.data || [])
	.filter((c) => c.name.startsWith('Ember') || c.name.startsWith('Bealls'))
	.map((c) => c.category_id || c.id);
if (wipeIds.length) {
	await api('DELETE', `/catalog/categories?id:in=${wipeIds.join(',')}`);
	console.log(`   ✓ Removed ${wipeIds.length}: ${wipeIds.join(',')}`);
} else {
	console.log('   ✓ Already clean');
}

// ─── 2. Create 8 new Bealls categories on tree 6 ──────────
console.log('\n2. Creating Bealls categories on tree 6...');
const newCats = await api('POST', '/catalog/trees/categories',
	BEALLS_CATEGORY_NAMES.map((label) => ({
		tree_id: NEW_TREE_ID,
		parent_id: 0,
		name: `Bealls ${label}`,
		is_visible: true,
	}))
);
console.log(`   ✓ Created ${newCats.data.length}`);
const newIdByName = new Map();
for (const c of newCats.data) {
	newIdByName.set(c.name, c.category_id);
	console.log(`     ${c.category_id} | "${c.name}"`);
}

// ─── 3. Build old→new category map ─────────────────────────
console.log('\n3. Building old→new category mapping...');
const tree1 = await api('GET', `/catalog/trees/${OLD_TREE_ID}/categories`);
const oldBeallsCats = (tree1.data || []).filter((c) => c.name.startsWith('Bealls '));
const remap = new Map(); // old id → new id
for (const old of oldBeallsCats) {
	const oldId = old.category_id || old.id;
	const newId = newIdByName.get(old.name);
	if (newId) {
		remap.set(oldId, newId);
		console.log(`   ${oldId} (${old.name}) → ${newId}`);
	}
}

// ─── 4. List products on channel 1 with old bealls categories ─
console.log('\n4. Finding products to migrate...');
const products = [];
let page = 1;
while (true) {
	const res = await api('GET', `/catalog/products?limit=250&page=${page}`);
	const batch = res.data || [];
	if (batch.length === 0) break;
	for (const p of batch) {
		// Only migrate products with a category in the old bealls cat set
		const hasOldCat = (p.categories || []).some((cid) => remap.has(cid));
		if (hasOldCat) products.push(p);
	}
	page++;
}
console.log(`   ✓ ${products.length} products to migrate`);

// ─── 5. PATCH each product's categories ────────────────────
console.log(`\n5. Updating product categories (concurrency 5)...`);
const updateResults = await mapConc(products, async (p) => {
	const newCategories = (p.categories || [])
		.map((cid) => remap.get(cid) ?? cid)
		.filter((cid, i, arr) => arr.indexOf(cid) === i);
	await api('PUT', `/catalog/products/${p.id}`, { categories: newCategories });
	return p.id;
}, 5);
const updated = updateResults.filter((r) => r.ok);
const updateFailed = updateResults.filter((r) => !r.ok);
console.log(`   ✓ Updated ${updated.length}/${products.length}`);
if (updateFailed.length) console.log(`   ✗ ${updateFailed.length} failed`);

// ─── 6. Add channel 1846324 assignments ────────────────────
console.log(`\n6. Adding channel ${NEW_CHANNEL_ID} assignments...`);
const productIds = updated.map((r) => r.value);
const BATCH = 50;
for (let i = 0; i < productIds.length; i += BATCH) {
	const batch = productIds.slice(i, i + BATCH);
	await api('PUT', '/catalog/products/channel-assignments',
		batch.map((pid) => ({ product_id: pid, channel_id: NEW_CHANNEL_ID })));
	process.stderr.write(`\r    ${Math.min(i + BATCH, productIds.length)}/${productIds.length}`);
}
process.stderr.write('\n');
console.log('   ✓ done');

// ─── 7. Remove channel 1 assignments ───────────────────────
console.log(`\n7. Removing channel ${OLD_CHANNEL_ID} assignments...`);
for (let i = 0; i < productIds.length; i += BATCH) {
	const batch = productIds.slice(i, i + BATCH);
	const ids = batch.join(',');
	try {
		await api('DELETE', `/catalog/products/channel-assignments?product_id:in=${ids}&channel_id:in=${OLD_CHANNEL_ID}`);
	} catch (e) {
		console.warn(`   batch ${i} skip: ${e.message}`);
	}
	process.stderr.write(`\r    ${Math.min(i + BATCH, productIds.length)}/${productIds.length}`);
}
process.stderr.write('\n');
console.log('   ✓ done');

// ─── 8. Wipe old bealls categories from tree 1 ────────────
console.log('\n8. Wiping old bealls categories from tree 1...');
const oldIds = oldBeallsCats.map((c) => c.category_id || c.id);
if (oldIds.length) {
	await api('DELETE', `/catalog/categories?id:in=${oldIds.join(',')}`);
	console.log(`   ✓ Removed ${oldIds.length}: ${oldIds.join(',')}`);
}

// ─── 9. Rename channels + trees ────────────────────────────
console.log('\n9. Renaming channels and trees...');
try {
	await api('PUT', `/channels/${NEW_CHANNEL_ID}`, { name: 'bealls' });
	console.log(`   ✓ Channel ${NEW_CHANNEL_ID} → "bealls"`);
} catch (e) { console.warn(`   ✗ channel rename: ${e.message}`); }

try {
	await api('PUT', `/catalog/trees`, [{ id: NEW_TREE_ID, name: 'bealls Catalog' }]);
	console.log(`   ✓ Tree ${NEW_TREE_ID} → "bealls Catalog"`);
} catch (e) { console.warn(`   ✗ tree rename: ${e.message}`); }

try {
	await api('PUT', `/channels/${OLD_CHANNEL_ID}`, { name: 'Demo' });
	console.log(`   ✓ Channel ${OLD_CHANNEL_ID} restored to "Demo"`);
} catch (e) { console.warn(`   ✗ ch1 rename: ${e.message}`); }

try {
	await api('PUT', `/catalog/trees`, [{ id: OLD_TREE_ID, name: 'Default catalog tree' }]);
	console.log(`   ✓ Tree ${OLD_TREE_ID} restored to "Default catalog tree"`);
} catch (e) { console.warn(`   ✗ tree1 rename: ${e.message}`); }

console.log('\n✓ Migration complete.\n');

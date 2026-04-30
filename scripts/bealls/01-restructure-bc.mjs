#!/usr/bin/env node
/**
 * Bealls engagement — BigCommerce store restructure.
 *
 * Single destructive operation that rebrands the existing aisles BC store from
 * Haven/Volt/Ember to bealls/beallsflorida. Required before Phase 4 catalog
 * seed.
 *
 * Steps (in order):
 *   1. Rename channel 1 ("Demo") → "bealls" + Tree 1 → "bealls Catalog"
 *   2. Rename channel 1846321 ("Volt") → "Bealls Florida"
 *      + Tree 5 → "Bealls Florida Catalog"
 *   3. Delete channel 1845940 ("My Catalyst Storefront") + its tree (stale)
 *   4. Delete all products globally (158)
 *   5. Delete legacy categories from Tree 1 and Tree 5
 *   6. Leave Channel 1846324 ("Ember") alone — unused but reserved
 *   7. Create new bealls categories under Tree 1 (8 categories)
 *   8. Create new Bealls Florida categories under Tree 5 (8 categories)
 *
 * Safe to re-run for steps that fail mid-way; each step is idempotent
 * within its scope.
 */
import 'dotenv/config';

const STORE = process.env.BIGCOMMERCE_STORE_HASH;
const TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;
const BASE = `https://api.bigcommerce.com/stores/${STORE}/v3`;

const headers = {
	'X-Auth-Token': TOKEN,
	'Content-Type': 'application/json',
	Accept: 'application/json',
};

async function api(method, path, body) {
	const url = `${BASE}${path}`;
	const opts = { method, headers };
	if (body) opts.body = JSON.stringify(body);

	const res = await fetch(url, opts);

	if (res.status === 429) {
		const wait = parseInt(res.headers.get('X-Rate-Limit-Time-Reset-Ms') || '1000');
		console.log(`  Rate limited, waiting ${wait}ms...`);
		await new Promise((r) => setTimeout(r, wait + 100));
		return api(method, path, body);
	}

	if (res.status === 204) return null;

	let data;
	try {
		data = await res.json();
	} catch {
		data = null;
	}

	if (!res.ok) {
		console.error(`  API error ${res.status}: ${method} ${path}`);
		console.error(`  Body: ${JSON.stringify(data, null, 2)}`);
		throw new Error(`API ${method} ${path} failed: ${res.status}`);
	}

	return data;
}

// ─── Step 1: Rename channels ─────────────────────────────────────

async function renameChannel(id, newName) {
	console.log(`  Renaming channel ${id} → "${newName}"...`);
	try {
		await api('PUT', `/channels/${id}`, { name: newName });
		console.log(`    ✓ done`);
	} catch (e) {
		// Channel 1 (default) may reject rename — non-fatal
		console.warn(`    ✗ rename failed: ${e.message}`);
		console.warn(`    (continuing — name is cosmetic, channel ID is what matters)`);
	}
}

async function renameTree(id, newName) {
	console.log(`  Renaming tree ${id} → "${newName}"...`);
	try {
		await api('PUT', `/catalog/trees`, [{ id, name: newName }]);
		console.log(`    ✓ done`);
	} catch (e) {
		console.warn(`    ✗ rename failed: ${e.message}`);
	}
}

// ─── Step 2: Delete a channel (after unwiring its tree) ──────────

async function deleteChannel(id) {
	console.log(`  Deleting channel ${id}...`);
	try {
		await api('DELETE', `/channels/${id}`);
		console.log(`    ✓ done`);
	} catch (e) {
		console.warn(`    ✗ deletion failed: ${e.message}`);
		console.warn(`    (it may have associated dependencies; can re-run later)`);
	}
}

// ─── Step 3: Delete all products globally ────────────────────────

async function deleteAllProducts() {
	console.log('\n=== Deleting all products ===');
	let total = 0;
	while (true) {
		const res = await api('GET', `/catalog/products?limit=50&page=1`);
		const products = res.data;
		if (products.length === 0) break;

		const ids = products.map((p) => p.id).join(',');
		await api('DELETE', `/catalog/products?id:in=${ids}`);
		total += products.length;
		console.log(`  Deleted ${total} products...`);
	}
	console.log(`  Done. Total: ${total} products deleted.`);
}

// ─── Step 4: Delete categories ───────────────────────────────────

async function deleteAllCategoriesInTree(treeId, keepNames = []) {
	console.log(`\n=== Deleting categories in tree ${treeId} ===`);
	let totalDeleted = 0;

	for (let round = 0; round < 10; round++) {
		const res = await api('GET', `/catalog/categories?tree_id:in=${treeId}&limit=250`);
		const cats = (res.data || []).filter((c) => !keepNames.includes(c.name));
		if (cats.length === 0) break;

		// Delete leaves first
		const leaves = cats.filter((c) => !cats.some((other) => other.parent_id === c.category_id));
		const leavesToDelete = leaves.length > 0 ? leaves : cats;

		const ids = leavesToDelete.map((c) => c.category_id).join(',');
		await api('DELETE', `/catalog/categories?id:in=${ids}`);
		totalDeleted += leavesToDelete.length;
		console.log(`  Deleted ${leavesToDelete.length} leaves (round ${round + 1}, total ${totalDeleted})`);
	}

	console.log(`  Done. ${totalDeleted} categories removed from tree ${treeId}.`);
}

// ─── Step 5: Create new categories ───────────────────────────────

async function createCategories(treeId, brandPrefix, categories) {
	console.log(`\n=== Creating ${brandPrefix} categories under tree ${treeId} ===`);
	const payload = categories.map((label) => ({
		tree_id: treeId,
		parent_id: 0,
		name: `${brandPrefix} ${label}`,
		is_visible: true,
	}));

	const res = await api('POST', '/catalog/trees/categories', payload);
	console.log(`  Created ${res.data.length} categories.`);
	for (const cat of res.data) {
		console.log(`    ${cat.category_id} | "${cat.name}"`);
	}
	return res.data;
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
	if (!STORE || !TOKEN) {
		throw new Error('Missing BIGCOMMERCE_STORE_HASH or BIGCOMMERCE_ACCESS_TOKEN');
	}

	console.log(`\n╔════════════════════════════════════════════════╗`);
	console.log(`║  Bealls — BigCommerce Restructure              ║`);
	console.log(`║  Store: ${STORE.padEnd(40)}║`);
	console.log(`╚════════════════════════════════════════════════╝`);

	// 1. Rename channels + trees
	console.log('\n=== Renaming channels and trees ===');
	await renameChannel(1, 'bealls');
	await renameTree(1, 'bealls Catalog');
	await renameChannel(1846321, 'Bealls Florida');
	await renameTree(5, 'Bealls Florida Catalog');

	// 2. Delete stale channel
	console.log('\n=== Removing stale channel 1845940 ===');
	await deleteChannel(1845940);

	// 3. Wipe catalog
	await deleteAllProducts();
	await deleteAllCategoriesInTree(1);
	await deleteAllCategoriesInTree(5);

	// 4. Create bealls categories under tree 1
	const beallsCategories = [
		'Women', 'Men', 'Kids', 'Shoes', 'Home', 'Beauty', 'Handbags', 'Accessories',
	];
	await createCategories(1, 'Bealls', beallsCategories);

	// 5. Create Bealls Florida categories under tree 5
	const bfCategories = [
		'Women', 'Men', 'Kids', 'Shoes', 'Home', 'Vacation', 'Swim & Beach', 'Accessories',
	];
	await createCategories(5, 'BeallsFlorida', bfCategories);

	console.log('\n✓ BC restructure complete.\n');
}

main().catch((e) => {
	console.error('\n✗ Fatal:', e.message);
	process.exit(1);
});

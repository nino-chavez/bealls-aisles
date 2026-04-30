#!/usr/bin/env node
/**
 * Cleanup pass — deletes all categories except the 16 newly-created ones for
 * bealls + Bealls Florida (IDs 250–265). Required because the initial
 * restructure script used the wrong field name (category_id vs id) and the
 * delete loop was a no-op.
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
		console.error(`API ${res.status}: ${method} ${path}\n${JSON.stringify(data, null, 2)}`);
		throw new Error(`API failure`);
	}
	return data;
}

// IDs to KEEP — the new bealls + BF categories.
const KEEP_IDS = new Set([
	250, 251, 252, 253, 254, 255, 256, 257, // Bealls
	258, 259, 260, 261, 262, 263, 264, 265, // Bealls Florida
]);

async function main() {
	console.log('\n=== Listing all categories ===');
	const res = await api('GET', '/catalog/categories?limit=250');
	const all = res.data || [];
	console.log(`  Total: ${all.length}`);

	const stale = all.filter((c) => !KEEP_IDS.has(c.id));
	const kept = all.filter((c) => KEEP_IDS.has(c.id));

	console.log(`  Keep (new bealls family): ${kept.length}`);
	for (const c of kept) console.log(`    ${c.id} | "${c.name}"`);

	console.log(`  Delete (legacy): ${stale.length}`);
	for (const c of stale) console.log(`    ${c.id} | "${c.name}"`);

	if (stale.length === 0) {
		console.log('\nNothing to delete.\n');
		return;
	}

	console.log('\n=== Deleting in batches ===');
	const BATCH = 25;
	let deleted = 0;
	for (let i = 0; i < stale.length; i += BATCH) {
		const batch = stale.slice(i, i + BATCH);
		const ids = batch.map((c) => c.id).join(',');
		try {
			await api('DELETE', `/catalog/categories?id:in=${ids}`);
			deleted += batch.length;
			console.log(`  Deleted batch (${i + 1}–${i + batch.length}, total ${deleted})`);
		} catch (e) {
			// Some categories may have dependencies (e.g., parent of others).
			// Try one-by-one for this batch.
			console.log(`  Batch failed; retrying individually...`);
			for (const c of batch) {
				try {
					await api('DELETE', `/catalog/categories?id:in=${c.id}`);
					deleted++;
				} catch (err) {
					console.warn(`    skip ${c.id} "${c.name}": ${err.message}`);
				}
			}
		}
	}

	console.log(`\nDone. ${deleted}/${stale.length} categories deleted.`);

	// Verify
	const after = await api('GET', '/catalog/categories?limit=250');
	console.log(`\nFinal category count: ${after.data.length}`);
	for (const c of after.data) console.log(`  ${c.id} | "${c.name}"`);
}

main().catch((e) => {
	console.error('Fatal:', e.message);
	process.exit(1);
});

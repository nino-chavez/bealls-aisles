#!/usr/bin/env node
/**
 * Final BC cleanup:
 *   - Delete leftover Volt categories from Tree 5 (Bealls Florida)
 *   - Set channel 1845940 ("My Catalyst Storefront") to status=deleted
 *     (BC doesn't support DELETE on channels, only soft-delete via PUT)
 *   - Leave Tree 6 (Ember) alone — channel is reserved
 *   - Leave Trees 2/3/4 alone — orphaned but not affecting the demo
 */
import 'dotenv/config';

const STORE = process.env.BIGCOMMERCE_STORE_HASH;
const TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;
const BASE = `https://api.bigcommerce.com/stores/${STORE}/v3`;
const headers = { 'X-Auth-Token': TOKEN, 'Content-Type': 'application/json', Accept: 'application/json' };

async function api(method, path, body) {
	const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
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

console.log('\n=== Cleaning leftover Volt categories from Tree 5 ===');
const tree5 = await api('GET', '/catalog/trees/5/categories');
const volts = (tree5.data || []).filter((c) => c.name.startsWith('Volt'));
if (volts.length === 0) {
	console.log('  Already clean.');
} else {
	const ids = volts.map((c) => c.category_id || c.id).join(',');
	console.log(`  Deleting ${volts.length}: ${ids}`);
	await api('DELETE', `/catalog/categories?id:in=${ids}`);
	console.log('  ✓ done');
}

console.log('\n=== Soft-deleting channel 1845940 ===');
try {
	await api('PUT', '/channels/1845940', { status: 'deleted' });
	console.log('  ✓ done');
} catch (e) {
	console.warn(`  ✗ failed: ${e.message}`);
}

console.log('\n=== Verification ===');
const channels = await api('GET', '/channels');
console.log('Active channels:');
for (const ch of channels.data.filter((c) => c.status !== 'deleted')) {
	console.log(`  ID ${ch.id} | "${ch.name}" | ${ch.status}`);
}

console.log('\nTree contents:');
for (const t of [1, 5, 6]) {
	const r = await api('GET', `/catalog/trees/${t}/categories`);
	console.log(`  Tree ${t}: ${(r.data || []).length} categories`);
	for (const c of (r.data || []).sort((a, b) => (a.category_id || a.id) - (b.category_id || b.id))) {
		console.log(`    ${c.category_id || c.id} | "${c.name}"`);
	}
}

console.log('\n');

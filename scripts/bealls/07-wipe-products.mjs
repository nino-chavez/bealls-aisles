#!/usr/bin/env node
/** Wipe all products from BC. Categories, channels, trees untouched. */
import 'dotenv/config';

const STORE = process.env.BIGCOMMERCE_STORE_HASH;
const TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;
const BASE = `https://api.bigcommerce.com/stores/${STORE}/v3`;
const headers = { 'X-Auth-Token': TOKEN, 'Content-Type': 'application/json', Accept: 'application/json' };

async function api(method, path) {
	const res = await fetch(`${BASE}${path}`, { method, headers });
	if (res.status === 429) {
		const wait = parseInt(res.headers.get('X-Rate-Limit-Time-Reset-Ms') || '1000');
		await new Promise((r) => setTimeout(r, wait + 100));
		return api(method, path);
	}
	if (res.status === 204) return null;
	const data = await res.json().catch(() => null);
	if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
	return data;
}

let total = 0;
while (true) {
	const res = await api('GET', '/catalog/products?limit=50&page=1');
	const products = res.data;
	if (products.length === 0) break;
	const ids = products.map((p) => p.id).join(',');
	await api('DELETE', `/catalog/products?id:in=${ids}`);
	total += products.length;
	process.stdout.write(`\r  Deleted ${total}...`);
}
console.log(`\nDone. ${total} products wiped.`);

#!/usr/bin/env node
/**
 * Update brand-specific env vars on the renamed Vercel projects:
 *   bealls          → BRAND_ID, VITE_BRAND_ID, BIGCOMMERCE_CHANNEL_ID, BEALLS_STOREFRONT_TOKEN
 *   beallsflorida   → BRAND_ID, VITE_BRAND_ID, BIGCOMMERCE_CHANNEL_ID, BEALLSFLORIDA_STOREFRONT_TOKEN
 *   homecentric     → BRAND_ID, VITE_BRAND_ID
 *
 * Uses the Vercel REST API directly (CLI doesn't support non-interactive env upsert).
 * Auth: ~/Library/Application Support/com.vercel.cli/auth.json
 */
import { readFile } from 'node:fs/promises';

const TEAM_ID = 'team_vLVmEhYvxAMEb4sx9xeZz27p';
const AUTH_FILE = `${process.env.HOME}/Library/Application Support/com.vercel.cli/auth.json`;
const TOKEN = JSON.parse(await readFile(AUTH_FILE, 'utf8')).token;
const TARGETS = ['production', 'preview', 'development'];

async function vapi(method, path, body) {
	const url = `https://api.vercel.com${path}${path.includes('?') ? '&' : '?'}teamId=${TEAM_ID}`;
	const res = await fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${TOKEN}`,
			'Content-Type': 'application/json',
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const data = await res.json().catch(() => null);
	if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
	return data;
}

async function listEnvs(project) {
	return vapi('GET', `/v9/projects/${project}/env?decrypt=true`);
}

async function deleteEnv(project, envId) {
	return vapi('DELETE', `/v9/projects/${project}/env/${envId}`);
}

async function addEnv(project, key, value, type = 'encrypted') {
	return vapi('POST', `/v10/projects/${project}/env`, [{
		key,
		value,
		type,
		target: TARGETS,
	}]);
}

async function setEnv(project, key, value, type = 'encrypted') {
	const all = await listEnvs(project);
	// Find existing entries with this key (could be multiple per env/branch)
	const existing = (all.envs || []).filter((e) => e.key === key);
	for (const e of existing) {
		await deleteEnv(project, e.id);
	}
	await addEnv(project, key, value, type);
	console.log(`    ✓ ${key}`);
}

const updates = {
	bealls: {
		BRAND_ID: { value: 'bealls', type: 'plain' },
		VITE_BRAND_ID: { value: 'bealls', type: 'plain' },
		BIGCOMMERCE_CHANNEL_ID: { value: '1846324', type: 'plain' },
		// BEALLS_STOREFRONT_TOKEN is the same as the previous EMBER_STOREFRONT_TOKEN
		// (channel 1846324 was Ember; we repurposed it).
		BEALLS_STOREFRONT_TOKEN: { fromExisting: 'EMBER_STOREFRONT_TOKEN', type: 'encrypted' },
	},
	beallsflorida: {
		BRAND_ID: { value: 'beallsflorida', type: 'plain' },
		VITE_BRAND_ID: { value: 'beallsflorida', type: 'plain' },
		BIGCOMMERCE_CHANNEL_ID: { value: '1846321', type: 'plain' },
		BEALLSFLORIDA_STOREFRONT_TOKEN: { fromExisting: 'VOLT_STOREFRONT_TOKEN', type: 'encrypted' },
	},
	homecentric: {
		BRAND_ID: { value: 'homecentric', type: 'plain' },
		VITE_BRAND_ID: { value: 'homecentric', type: 'plain' },
		// content-mode brand — channel ID is irrelevant; leave whatever's there
	},
};

for (const [project, vars] of Object.entries(updates)) {
	console.log(`\n=== ${project} ===`);
	const all = await listEnvs(project);
	const byKey = new Map();
	for (const e of all.envs || []) byKey.set(e.key, e);

	for (const [key, spec] of Object.entries(vars)) {
		let value = spec.value;
		if (spec.fromExisting) {
			const src = byKey.get(spec.fromExisting);
			if (!src?.value) {
				console.warn(`    ✗ ${key}: source ${spec.fromExisting} not found / not decrypted`);
				continue;
			}
			value = src.value;
		}
		try {
			await setEnv(project, key, value, spec.type);
		} catch (e) {
			console.warn(`    ✗ ${key}: ${e.message}`);
		}
	}
}

console.log('\n✓ Done.\n');

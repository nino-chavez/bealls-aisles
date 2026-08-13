#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(root, '.svelte-kit', 'cloudflare');
const buildReceiptPath = path.join(root, '.svelte-kit', 'cloudflare-current-preview.json');
const configPath = path.join(root, 'wrangler.jsonc');
const hostingProfile = 'current-main-preview-v1';

const brands = Object.freeze({
	bealls: {
		environment: 'bealls',
		worker: 'aisles-bealls-current-preview',
	},
	homecentric: {
		environment: 'homecentric',
		worker: 'aisles-homecentric-current-preview',
	},
	beallsflorida: {
		environment: 'beallsflorida',
		worker: 'aisles-beallsflorida-current-preview',
	},
});

const strippedApplicationSecrets = [
	'ANTHROPIC_API_KEY',
	'OPENROUTER_API_KEY',
	'AI_GATEWAY_API_KEY',
	'AI_GATEWAY_TOKEN',
	'AI_GATEWAY_URL',
	'CF_AIG_ACCOUNT_ID',
	'CF_AIG_GATEWAY_ID',
	'DATABASE_URL',
	'POSTGRES_URL',
	'KV_REST_API_URL',
	'KV_REST_API_TOKEN',
	'BIGCOMMERCE_STORE_HASH',
	'BIGCOMMERCE_CLIENT_ID',
	'BIGCOMMERCE_CLIENT_SECRET',
	'BIGCOMMERCE_ACCESS_TOKEN',
	'BIGCOMMERCE_STOREFRONT_TOKEN',
	'BEALLS_STOREFRONT_TOKEN',
	'BEALLSFLORIDA_STOREFRONT_TOKEN',
	'STOREFRONT_TOKEN',
];

const [action, brandId, targetUrl] = process.argv.slice(2);

try {
	if (!['build', 'verify', 'deploy', 'smoke'].includes(action)) {
		throw new Error('Usage: cloudflare-current-preview.mjs <build|verify|deploy|smoke> <brand> [https://deployment-url]');
	}
	const brand = brands[brandId];
	if (!brand) {
		throw new Error(`Unknown brand "${brandId || ''}". Expected one of: ${Object.keys(brands).join(', ')}`);
	}

	if (action === 'smoke') {
		await smokeDeployment(brandId, targetUrl);
	} else {
		buildBrand(brandId, brand);
		if (action === 'verify') verifyWranglerDryRun(brandId, brand);
		if (action === 'deploy') deployBrand(brandId, brand);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}

function buildBrand(brandId, brand) {
	const env = applicationEnvironment(brandId);
	run('npm', ['run', 'build'], env);

	const workerPath = path.join(outputRoot, '_worker.js');
	if (!fs.existsSync(workerPath)) {
		throw new Error(`Cloudflare adapter did not produce ${path.relative(root, workerPath)}`);
	}
	const clientRoot = path.join(outputRoot, '_app');
	if (!fs.existsSync(clientRoot)) {
		throw new Error(`Cloudflare adapter did not produce ${path.relative(root, clientRoot)}`);
	}

	const retiredReferences = findRetiredEndpointReferences(clientRoot);
	if (retiredReferences.length > 0) {
		throw new Error(`Shopper client bundle references retired endpoints: ${retiredReferences.join(', ')}`);
	}

	const receipt = {
		schemaVersion: 'aisles-cloudflare-current-preview-build-v1',
		brandId,
		wranglerEnvironment: brand.environment,
		worker: brand.worker,
		hostingProfile,
		fixture: 'v1',
		modelCredentials: 'stripped-before-build',
		backendCredentials: 'stripped-before-build',
		shopperClientRetiredEndpointReferences: retiredReferences,
		gitCommit: gitCommit(),
		workerSha256: sha256(fs.readFileSync(workerPath)),
	};
	fs.writeFileSync(buildReceiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
	console.log(JSON.stringify(receipt));
}

function verifyWranglerDryRun(brandId, brand) {
	assertReceipt(brandId, brand);
	const dryRunDirectory = path.join(root, '.wrangler', 'current-preview-dry-run', brandId);
	run('npx', [
		'wrangler', 'deploy', '--dry-run', '--config', configPath,
		'--env', brand.environment, '--outdir', dryRunDirectory,
	], deploymentEnvironment());
}

function deployBrand(brandId, brand) {
	if (brandId === 'homecentric' && process.env.AISLES_BEALLS_PREVIEW_VERIFIED !== 'v1') {
		throw new Error('Home Centric promotion is blocked until Bealls preview smoke is recorded; set AISLES_BEALLS_PREVIEW_VERIFIED=v1 only after that review.');
	}
	if (brandId === 'beallsflorida') {
		throw new Error('Bealls Florida promotion is blocked until its live catalog and channel validity are verified and this gate is deliberately amended.');
	}
	assertReceipt(brandId, brand);
	run('npx', ['wrangler', 'deploy', '--config', configPath, '--env', brand.environment], deploymentEnvironment());
}

async function smokeDeployment(brandId, targetUrl) {
	if (!targetUrl) throw new Error('Smoke requires the exact HTTPS deployment URL.');
	const origin = new URL(targetUrl);
	if (origin.protocol !== 'https:') throw new Error('Smoke target must use HTTPS.');

	const home = await fetch(new URL('/', origin), { redirect: 'manual' });
	const html = await home.text();
	assert(home.status === 200, `GET / returned ${home.status}, expected 200`);
	assert(home.headers.get('x-aisles-brand-id') === brandId, 'GET / response header did not expose the exact active brand');
	assert(home.headers.get('x-aisles-hosting-profile') === hostingProfile, 'GET / response did not expose the current-main hosting profile');
	assert(home.headers.get('x-aisles-catalog-mode') === 'parity-fixture-v1', 'GET / response did not prove the no-paid fixture');
	assert(home.headers.get('x-aisles-shopper-model-authority') === 'none', 'GET / response did not prove zero shopper model authority');
	assert(
		html.includes(`data-brand-id="${brandId}"`),
		`GET / did not expose exact active brand data-brand-id="${brandId}"`,
	);

	const retired = [
		['/api/layout', 403],
		['/api/layout/stream', 410],
		['/api/refine', 403],
		['/api/suggest', 403],
	];
	for (const [pathname, expectedStatus] of retired) {
		const response = await fetch(new URL(pathname, origin), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{}',
			redirect: 'manual',
		});
		assert(response.status === expectedStatus, `${pathname} returned ${response.status}, expected ${expectedStatus}`);
		if (pathname === '/api/layout') {
			const payload = await response.json();
			assert(payload?.meta?.modelCalled === false, '/api/layout did not prove modelCalled=false');
		}
	}

	console.log(JSON.stringify({ brandId, target: origin.origin, status: 'smoke-passed', fixture: 'v1', modelCalls: 0 }));
}

function applicationEnvironment(brandId) {
	const env = { ...process.env };
	for (const key of strippedApplicationSecrets) delete env[key];
	return {
		...env,
		AISLES_ADAPTER: 'cloudflare',
		AISLES_HOSTING_PROFILE: hostingProfile,
		AISLES_PARITY_FIXTURE: 'v1',
		BRAND_ID: brandId,
		VITE_BRAND_ID: brandId,
	};
}

function deploymentEnvironment() {
	const env = { ...process.env };
	for (const key of strippedApplicationSecrets) delete env[key];
	return env;
}

function assertReceipt(brandId, brand) {
	if (!fs.existsSync(buildReceiptPath)) throw new Error('Cloudflare build receipt is missing.');
	const receipt = JSON.parse(fs.readFileSync(buildReceiptPath, 'utf8'));
	assert(receipt.brandId === brandId, `Build receipt brand is ${receipt.brandId}, not ${brandId}`);
	assert(receipt.wranglerEnvironment === brand.environment, 'Build receipt Wrangler environment does not match');
	assert(receipt.worker === brand.worker, 'Build receipt Worker does not match');
	assert(receipt.fixture === 'v1', 'Build receipt is not the no-paid fixture');
	assert(receipt.hostingProfile === hostingProfile, 'Build receipt hosting profile does not match');
}

function findRetiredEndpointReferences(directory) {
	const retired = ['/api/layout', '/api/refine', '/api/suggest'];
	const references = [];
	for (const file of filesUnder(directory)) {
		if (!file.endsWith('.js')) continue;
		const source = fs.readFileSync(file, 'utf8');
		for (const endpoint of retired) {
			if (source.includes(endpoint)) references.push(`${path.relative(outputRoot, file)}:${endpoint}`);
		}
	}
	return references.sort();
}

function filesUnder(directory) {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const absolute = path.join(directory, entry.name);
		return entry.isDirectory() ? filesUnder(absolute) : [absolute];
	});
}

function run(command, args, env) {
	const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited ${result.status}`);
}

function gitCommit() {
	const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
	if (result.status !== 0) throw new Error('Could not resolve git commit for build receipt');
	return result.stdout.trim();
}

function sha256(value) {
	return createHash('sha256').update(value).digest('hex');
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

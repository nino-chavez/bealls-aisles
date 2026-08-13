#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
	artifactIdentity,
	assertArtifactIdentity,
	assertAttestableSourceStatus,
	assertRemoteWorkerInventory,
	deriveBuildIdentity,
} from '../src/lib/server/cloudflare-preview-release-gates.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(root, '.svelte-kit', 'cloudflare');
const adapterInputRoot = path.join(root, '.svelte-kit');
const buildReceiptPath = path.join(root, '.svelte-kit', 'cloudflare-current-preview.json');
const configPath = path.join(root, 'wrangler.jsonc');
const hostingProfile = 'current-main-preview-v1';
const intendedCloudflareAccountId = 'b6ffcf200d56bab5749e243f024658d2';

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
	'VERCEL_OIDC_TOKEN',
	'OBSERVE_ACCESS_TOKEN',
	'MERCHANT_REVIEW_ACCESS_TOKEN',
];

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main(process.argv.slice(2));

async function main([action, brandId, targetUrl]) {
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
			if (action === 'deploy') await deployBrand(brandId, brand);
		}
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}

function buildBrand(brandId, brand) {
	assertAttestableSourceStatus(gitStatus());
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

	const deployableArtifact = artifactIdentity(outputRoot);
	const adapterInputs = artifactIdentity(adapterInputRoot, new Set([
		'cloudflare-current-preview.json',
	]));
	const receipt = {
		schemaVersion: 'aisles-cloudflare-current-preview-build-v2',
		brandId,
		wranglerEnvironment: brand.environment,
		worker: brand.worker,
		hostingProfile,
		fixture: 'v1',
		modelCredentials: 'stripped-before-build',
		backendCredentials: 'stripped-before-build',
		shopperClientRetiredEndpointReferences: retiredReferences,
		gitCommit: gitCommit(),
		deployableArtifact,
		adapterInputs,
	};
	receipt.buildIdentity = deriveBuildIdentity(receipt);
	receipt.deploymentConfigSha256 = writeResolvedDeploymentConfig(brandId, brand, receipt);
	writeReceipt(receipt);
	console.log(JSON.stringify(receipt));
}

function verifyWranglerDryRun(brandId, brand) {
	assertReceipt(brandId, brand);
	const dryRunDirectory = path.join(root, '.wrangler', 'current-preview-dry-run', brandId);
	fs.rmSync(dryRunDirectory, { recursive: true, force: true });
	run('npx', [
		'wrangler', 'deploy', '--dry-run', '--config', resolvedConfigPath(brandId),
		'--outdir', dryRunDirectory,
	], deploymentEnvironment());
	const receipt = readReceipt();
	receipt.wranglerDryRunArtifact = artifactIdentity(dryRunDirectory, new Set(['README.md']));
	writeReceipt(receipt);
	assertReceipt(brandId, brand, { requireWranglerDryRun: true });
}

async function deployBrand(brandId, brand) {
	if (brandId === 'homecentric' && process.env.AISLES_BEALLS_PREVIEW_VERIFIED !== 'v1') {
		throw new Error('Home Centric promotion is blocked until Bealls preview smoke is recorded; set AISLES_BEALLS_PREVIEW_VERIFIED=v1 only after that review.');
	}
	if (brandId === 'beallsflorida') {
		throw new Error('Bealls Florida promotion is blocked until its live catalog and channel validity are verified and this gate is deliberately amended.');
	}
	assertTargetAccount();
	verifyWranglerDryRun(brandId, brand);
	await preflightRemoteWorker(brandId, brand);
	// Re-derive after the remote read so local tampering during preflight also fails.
	assertReceipt(brandId, brand, { requireWranglerDryRun: true });
	run('npx', ['wrangler', 'deploy', '--strict', '--config', resolvedConfigPath(brandId)], deploymentEnvironment());
}

async function smokeDeployment(brandId, targetUrl) {
	if (!targetUrl) throw new Error('Smoke requires the exact HTTPS deployment URL.');
	const origin = new URL(targetUrl);
	if (origin.protocol !== 'https:') throw new Error('Smoke target must use HTTPS.');
	const brand = brands[brandId];
	assertReceipt(brandId, brand, { requireWranglerDryRun: true });
	const receipt = readReceipt();

	const home = await fetch(new URL('/', origin), { redirect: 'manual' });
	const html = await home.text();
	assert(home.status === 200, `GET / returned ${home.status}, expected 200`);
	assert(home.headers.get('x-aisles-brand-id') === brandId, 'GET / response header did not expose the exact active brand');
	assert(home.headers.get('x-aisles-hosting-profile') === hostingProfile, 'GET / response did not expose the current-main hosting profile');
	assert(home.headers.get('x-aisles-catalog-mode') === 'parity-fixture-v1', 'GET / response did not prove the no-paid fixture');
	assert(home.headers.get('x-aisles-shopper-model-authority') === 'none', 'GET / response did not prove zero shopper model authority');
	assert(home.headers.get('x-aisles-build-id') === receipt.buildIdentity, 'GET / did not match the fresh local build receipt identity');
	assert(home.headers.get('x-aisles-source-commit') === receipt.gitCommit, 'GET / did not match the fresh local source commit');
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

	if (brandId !== 'homecentric') {
		const pdp = await fetch(new URL('/product/parity-coastal-shirt', origin), { redirect: 'manual' });
		const pdpHtml = await pdp.text();
		assert(pdp.status === 200, `Fixture PDP returned ${pdp.status}, expected 200`);
		assertExactDecisionModes(pdpHtml, {
			'pdp.below-description': 'fixed',
			'pdp.related': 'rules',
			'pdp.cross-sell': 'rules',
			'pdp.recently-viewed': 'rules',
			'pdp.below-recs': 'fixed',
		});

		const plp = await fetch(new URL('/category/women', origin), { redirect: 'manual' });
		const plpHtml = await plp.text();
		assert(plp.status === 200, `Fixture PLP returned ${plp.status}, expected 200`);
		assertExactDecisionModes(plpHtml, {
			'plp.banner': 'fixed',
			'plp.editorial-header': 'fixed',
			'plp.cluster-row': 'fixed',
			'plp.between-thirds': 'fixed',
			'plp.below-grid': 'fixed',
			'plp.empty-state': 'fixed',
		});

		const search = await fetch(new URL('/search?q=Parity', origin), { redirect: 'manual' });
		const searchHtml = await search.text();
		assert(search.status === 200, `Fixture search returned ${search.status}, expected 200`);
		assertExactDecisionModes(searchHtml, {
			'search.empty-state': 'fixed',
			'search.zero-results-rescue': 'fixed',
		});
	} else {
		const category = await fetch(new URL('/category/bedroom', origin), { redirect: 'manual' });
		const categoryHtml = await category.text();
		assert(category.status === 200, `Home Centric fixed category returned ${category.status}, expected 200`);
		const executions = zoneExecutions(categoryHtml);
		assert(executions.some((execution) => execution.surface === 'category' && execution.decisions.length === 0),
			'Home Centric category did not prove its fixed content-surface boundary');
	}

	console.log(JSON.stringify({
		brandId, target: origin.origin, status: 'smoke-passed', fixture: 'v1', modelCalls: 0,
		buildIdentity: receipt.buildIdentity, gitCommit: receipt.gitCommit,
	}));
}

function assertExactDecisionModes(html, expected) {
	const executions = zoneExecutions(html);
	const actual = new Map(executions.flatMap((execution) =>
		execution.decisions.map((decision) => [decision.zoneId, decision.decisionMode])));
	for (const [zoneId, mode] of Object.entries(expected)) {
		assert(actual.get(zoneId) === mode, `${zoneId} exposed ${actual.get(zoneId) || 'no mode'}, expected ${mode}`);
	}
	assert([...actual.keys()].filter((zoneId) => Object.hasOwn(expected, zoneId)).length === Object.keys(expected).length,
		'Zone policy proof was incomplete');
}

function zoneExecutions(html) {
	const match = html.match(/data-zone-execution="([^"]+)"/);
	assert(match, 'Page did not expose data-zone-execution policy proof');
	const decoded = match[1]
		.replaceAll('&quot;', '"').replaceAll('&#39;', "'")
		.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
	return JSON.parse(decoded);
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

export function assertReceipt(brandId, brand, { requireWranglerDryRun = false } = {}) {
	const receipt = readReceipt();
	assert(receipt.schemaVersion === 'aisles-cloudflare-current-preview-build-v2', 'Build receipt schema is obsolete');
	assert(receipt.brandId === brandId, `Build receipt brand is ${receipt.brandId}, not ${brandId}`);
	assert(receipt.wranglerEnvironment === brand.environment, 'Build receipt Wrangler environment does not match');
	assert(receipt.worker === brand.worker, 'Build receipt Worker does not match');
	assert(receipt.fixture === 'v1', 'Build receipt is not the no-paid fixture');
	assert(receipt.hostingProfile === hostingProfile, 'Build receipt hosting profile does not match');
	assertArtifactIdentity(receipt.deployableArtifact, outputRoot, 'Cloudflare deployable artifact');
	assertArtifactIdentity(
		receipt.adapterInputs,
		adapterInputRoot,
		'Cloudflare adapter inputs',
		new Set(['cloudflare-current-preview.json']),
	);
	assert(receipt.buildIdentity === deriveBuildIdentity(receipt), 'Build receipt identity does not match its deployable artifact and source');
	assert(receipt.deploymentConfigSha256 === sha256(fs.readFileSync(resolvedConfigPath(brandId))),
		'Resolved deployment config changed after its receipt was written');
	if (requireWranglerDryRun) {
		const dryRunDirectory = path.join(root, '.wrangler', 'current-preview-dry-run', brandId);
		assertArtifactIdentity(
			receipt.wranglerDryRunArtifact,
			dryRunDirectory,
			'Wrangler dry-run artifact',
			new Set(['README.md']),
		);
	}
}

function resolvedConfigPath(brandId) {
	return path.join(root, '.wrangler', 'current-preview-config', `${brandId}.json`);
}

function writeResolvedDeploymentConfig(brandId, brand, receipt) {
	const base = JSON.parse(fs.readFileSync(configPath, 'utf8'));
	assert(base.account_id === intendedCloudflareAccountId, 'Wrangler config does not pin the intended Cloudflare account');
	const target = base.env?.[brand.environment];
	assert(target?.name === brand.worker, `Wrangler environment ${brand.environment} does not name ${brand.worker}`);
	const resolved = {
		$schema: base.$schema,
		account_id: base.account_id,
		name: target.name,
		main: '../../.svelte-kit/cloudflare/_worker.js',
		compatibility_date: base.compatibility_date,
		compatibility_flags: base.compatibility_flags,
		workers_dev: base.workers_dev,
		preview_urls: base.preview_urls,
		observability: base.observability,
		assets: { ...base.assets, directory: '../../.svelte-kit/cloudflare' },
		vars: {
			...target.vars,
			AISLES_BUILD_ID: receipt.buildIdentity,
			AISLES_SOURCE_COMMIT: receipt.gitCommit,
		},
	};
	const output = resolvedConfigPath(brandId);
	fs.mkdirSync(path.dirname(output), { recursive: true });
	fs.writeFileSync(output, `${JSON.stringify(resolved, null, 2)}\n`);
	return sha256(fs.readFileSync(output));
}

function readReceipt() {
	if (!fs.existsSync(buildReceiptPath)) throw new Error('Cloudflare build receipt is missing.');
	return JSON.parse(fs.readFileSync(buildReceiptPath, 'utf8'));
}

function writeReceipt(receipt) {
	fs.writeFileSync(buildReceiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
}

async function preflightRemoteWorker(brandId, brand) {
	assertTargetAccount();
	const inventory = inspectRemoteWorker(brand);
	assertRemoteWorkerInventory(inventory, brandId, brand);
	console.log(JSON.stringify({
		brandId,
		worker: brand.worker,
		remoteInventory: inventory.state,
		activeVersions: inventory.state === 'present' ? inventory.versions.length : 0,
		status: 'remote-preflight-passed',
	}));
}

function inspectRemoteWorker(brand) {
	const baseArgs = ['--config', resolvedConfigPath(brand.environment), '--name', brand.worker];
	const status = runWranglerJson(['deployments', 'status', ...baseArgs, '--json'], { allowWorkerNotFound: true });
	if (status === workerNotFound) return { state: 'absent', secrets: [], versions: [] };

	assert(status && Array.isArray(status.versions) && status.versions.length > 0,
		`Remote Worker ${brand.worker} exists but its active deployment inventory is unavailable`);
	const secrets = runWranglerJson(['secret', 'list', ...baseArgs, '--format', 'json']);
	assert(Array.isArray(secrets), `Remote Worker ${brand.worker} secret inventory was not an array`);
	const versions = status.versions.map((traffic) => {
		assert(typeof traffic?.version_id === 'string' && traffic.version_id,
			`Remote Worker ${brand.worker} returned an active deployment without a version ID`);
		const version = runWranglerJson(['versions', 'view', traffic.version_id, ...baseArgs, '--json']);
		assert(Array.isArray(version?.resources?.bindings),
			`Remote Worker ${brand.worker} version ${traffic.version_id} did not expose its bindings`);
		return { id: traffic.version_id, percentage: traffic.percentage, bindings: version.resources.bindings };
	});
	return { state: 'present', secrets, versions };
}

function assertTargetAccount() {
	const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
	assert(config.account_id === intendedCloudflareAccountId,
		`Cloudflare account must be exactly ${intendedCloudflareAccountId}`);
	const ambient = process.env.CLOUDFLARE_ACCOUNT_ID;
	assert(!ambient || ambient === intendedCloudflareAccountId,
		`CLOUDFLARE_ACCOUNT_ID ${ambient} does not match intended account ${intendedCloudflareAccountId}`);
}

const workerNotFound = Symbol('worker-not-found');

function runWranglerJson(args, { allowWorkerNotFound = false } = {}) {
	const result = spawnSync('npx', ['wrangler', ...args], {
		cwd: root,
		env: deploymentEnvironment(),
		encoding: 'utf8',
		maxBuffer: 10 * 1024 * 1024,
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		const output = `${result.stderr || ''}\n${result.stdout || ''}`;
		if (allowWorkerNotFound && /(?:\[code:\s*10007\]|"code"\s*:\s*10007)/.test(output)) return workerNotFound;
		throw new Error(`Read-only Wrangler inventory command failed for ${args.join(' ')}: ${output.trim() || `exit ${result.status}`}`);
	}
	try {
		return JSON.parse(result.stdout);
	} catch {
		throw new Error(`Read-only Wrangler inventory command returned invalid JSON for ${args.join(' ')}`);
	}
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
	return fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name)).flatMap((entry) => {
		const absolute = path.join(directory, entry.name);
		if (entry.isSymbolicLink()) throw new Error(`Artifact contains a symbolic link: ${absolute}`);
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

function gitStatus() {
	const result = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
	if (result.status !== 0) throw new Error('Could not inspect source status for build receipt');
	return result.stdout.trim();
}

function sha256(value) {
	return createHash('sha256').update(value).digest('hex');
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

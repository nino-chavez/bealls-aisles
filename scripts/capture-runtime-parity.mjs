#!/usr/bin/env node
/**
 * Pristine-main vs candidate regression evidence for the Bealls family.
 *
 * The baseline source is pinned to the main commit at adoption. A narrow,
 * recorded catalog fixture overlay is applied to a temporary detached
 * worktree on both sides. Paid/model/database credentials are blanked, model
 * browser requests are intercepted, and no visual delta is self-approved.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const PINNED_PRISTINE_MAIN = '71e8750f9070fb788816f0464355f46ab63fb272';
const FIXTURE_VERSION = 'bealls-family-catalog-v1';
const LOCAL_ROUTE_SECRET = 'local-parity-only-route-secret-0000000000000000000000000000000000';
const candidateRoot = runGit(['rev-parse', '--show-toplevel'], process.cwd());
const commonGitDir = path.resolve(candidateRoot, runGit(['rev-parse', '--git-common-dir']));
const canonicalRoot = path.dirname(commonGitDir);
const defaultOutputRoot = path.join(candidateRoot, 'validation/runtime-parity/full-adoption');
const outputRoot = path.resolve(process.env.PARITY_OUTPUT ?? defaultOutputRoot);
const baselineRoot = path.join(canonicalRoot, '.worktrees', `parity-baseline-${process.pid}`);
const viteBin = path.join(candidateRoot, 'node_modules/vite/bin/vite.js');
const candidateRef = runGit(['rev-parse', 'HEAD']);
const candidateDiffHash = sha256(runGit(['diff', '--binary', 'HEAD']) + runGit(['status', '--short']));
const fixtureSourceHash = sha256(fs.readFileSync(path.join(candidateRoot, 'src/lib/server/parity-fixture.ts')));

const brands = {
	bealls: { name: 'bealls', category: 'women', storefront: true, primary: '#aa182c', secondary: '#7d2540', accent: '#330a3d' },
	beallsflorida: { name: 'Bealls Florida', category: 'women', storefront: true, primary: '#037cc2', secondary: '#02639c', accent: '#cf4a29' },
	homecentric: { name: 'Home Centric', category: 'bedroom', storefront: false, primary: '#328812', secondary: '#3a9f15', accent: '#d04429' },
};
const viewports = {
	mobile: { width: 390, height: 844 },
	tablet: { width: 768, height: 1024 },
	desktop: { width: 1280, height: 900 },
};

const HOME_ZONES = ['home.hero', ...Array.from({ length: 6 }, (_, index) => `home.featured-row.${index + 1}`), 'home.editorial-strip', 'home.brand-spotlight', 'home.below-fold'];
const SURFACE_ZONES = {
	home: HOME_ZONES,
	plp: ['plp.banner', 'plp.editorial-header', 'plp.cluster-row', 'plp.between-thirds', 'plp.below-grid', 'plp.empty-state'],
	pdp: ['pdp.below-description', 'pdp.related', 'pdp.cross-sell', 'pdp.recently-viewed', 'pdp.below-recs'],
	cart: ['cart.above-checkout-cta', 'cart.below-fold', 'cart.empty-state'],
	checkout: ['checkout.assurance-strip', 'checkout.last-chance-upsell'],
	search: ['search.empty-state', 'search.zero-results-rescue'],
	account: ['account.welcome', ...Array.from({ length: 4 }, (_, index) => `account.dashboard-pick.${index + 1}`)],
	locator: ['locator.editorial-intro'],
	'error-404': ['error-404.rescue'],
	'error-empty': ['error-empty.rescue'],
};
const ALL_STOREFRONT_ZONES = Object.values(SURFACE_ZONES).flat();
const ALL_CONTENT_ZONES = [...HOME_ZONES, ...SURFACE_ZONES.locator, ...SURFACE_ZONES['error-404']];

if (!process.env.PARITY_OUTPUT && fs.existsSync(defaultOutputRoot)) {
	fs.rmSync(defaultOutputRoot, { recursive: true, force: true });
}
fs.mkdirSync(outputRoot, { recursive: true });
const manifest = {
	schemaVersion: 'bealls-family-runtime-parity-v2',
	kind: 'internal-regression-parity',
	externalReference: { state: 'uncontracted', claim: 'not-external-reference-preservation' },
	baseline: { ref: PINNED_PRISTINE_MAIN, source: 'pristine-main-plus-identical-test-fixture-overlay' },
	candidate: { ref: candidateRef, workingTreeDiffHash: candidateDiffHash },
	fixture: {
		version: FIXTURE_VERSION,
		catalogSourceHash: fixtureSourceHash,
		paidCredentials: 'explicitly blank',
		modelRequests: 'browser-intercepted',
		visualMasks: 'none',
		visualThreshold: 'none',
	},
	metadataInventory: { executableEndpoints: 30, addressablePageAndMethodHandlers: 34, zoneFamilies: 28, expandedZoneInstances: 36 },
	actualEvidence: { routeCellsPerSide: 0, screenshots: 0, materializedZoneScreenshots: 0 },
	cells: [],
	zoneCoverage: [],
	visualReview: { state: 'pending', cellsWithPixelDelta: 0, totalChangedPixels: 0 },
	mechanicalFailures: [],
};

let browser;
let baselineServer;
let candidateServer;
try {
	prepareBaselineWorktree();
	manifest.baseline.fixtureOverlayHash = hashBaselineOverlay();
	browser = await chromium.launch({ channel: 'chrome', headless: true });

	for (const [brandId, brand] of Object.entries(brands)) {
		const routes = shopperRoutes(brand);
		baselineServer = await startServer('baseline', baselineRoot, brandId, 5310);
		const baselineCells = await captureSide(browser, 'baseline', baselineServer.baseUrl, brandId, brand, routes);
		await stopServer(baselineServer);
		baselineServer = null;

		candidateServer = await startServer('candidate', candidateRoot, brandId, 5410);
		const candidateCells = await captureSide(browser, 'candidate', candidateServer.baseUrl, brandId, brand, routes);
		await stopServer(candidateServer);
		candidateServer = null;

		for (const key of [...baselineCells.keys()].sort()) {
			const baseline = baselineCells.get(key);
			const candidate = candidateCells.get(key);
			if (!candidate) throw new Error(`candidate capture missing ${brandId}/${key}`);
			const diff = compareScreenshots(baseline.screenshot, candidate.screenshot, diffPath(brandId, key));
			manifest.visualReview.totalChangedPixels += diff.changedPixels;
			if (diff.changedPixels > 0) manifest.visualReview.cellsWithPixelDelta++;
			manifest.cells.push({
				key: `${brandId}/${key}`,
				baseline,
				candidate,
				recordedMetricComparison: compareRecordedMetrics(baseline.metrics, candidate.metrics),
				screenshotDiff: diff,
			});
		}

		for (const [viewportName] of Object.entries(viewports)) {
			const relevant = [...candidateCells.values()].filter((cell) => cell.viewport === viewportName);
			const observed = new Map();
			for (const cell of relevant) {
				for (const execution of cell.metrics.zoneExecutions) {
					for (const decision of execution.decisions) observed.set(decision.zoneId, decision.terminal);
				}
			}
			const expected = brand.storefront ? ALL_STOREFRONT_ZONES : ALL_CONTENT_ZONES;
			const missing = expected.filter((zoneId) => !observed.has(zoneId));
			const unexpected = [...observed.keys()].filter((zoneId) => !expected.includes(zoneId));
			manifest.zoneCoverage.push({
				brandId, viewport: viewportName, expectedCount: expected.length, observedCount: observed.size,
				missing, unexpected, terminals: Object.fromEntries([...observed.entries()].sort()),
			});
			if (missing.length || unexpected.length) manifest.mechanicalFailures.push(`${brandId}/${viewportName}: zone coverage mismatch`);
		}
	}

	manifest.actualEvidence.routeCellsPerSide = manifest.cells.length;
	manifest.actualEvidence.screenshots = manifest.cells.length * 3; // baseline, candidate, unmasked diff
	manifest.actualEvidence.materializedZoneScreenshots = manifest.cells.reduce((sum, cell) => sum + cell.candidate.materializedZoneScreenshots.length, 0);
	manifest.visualReview.state = manifest.visualReview.cellsWithPixelDelta > 0 ? 'human-review-required' : 'no-pixel-delta';
	manifest.completedAt = new Date().toISOString();
	manifest.mechanicalPass = manifest.mechanicalFailures.length === 0;
} catch (error) {
	manifest.mechanicalFailures.push(error instanceof Error ? error.stack ?? error.message : String(error));
	manifest.mechanicalPass = false;
	manifest.visualReview.state = 'not-completed';
	throw error;
} finally {
	if (baselineServer) await stopServer(baselineServer);
	if (candidateServer) await stopServer(candidateServer);
	if (browser) await browser.close();
	writeManifest();
	removeBaselineWorktree();
}

console.log(path.join(outputRoot, 'manifest.json'));
if (!manifest.mechanicalPass) process.exitCode = 1;

function shopperRoutes(brand) {
	return [
		{ id: 'home', path: '/', expected: 200 },
		{ id: 'account', path: '/account', expected: brand.storefront ? 200 : 404 },
		{ id: 'cart', path: '/cart', expected: brand.storefront ? 200 : 404 },
		{ id: 'category', path: `/category/${brand.category}`, expected: 200 },
		{ id: 'checkout', path: '/checkout', expected: brand.storefront ? 200 : 404 },
		{ id: 'compare', path: '/compare', expected: brand.storefront ? 200 : 404 },
		{ id: 'product', path: '/product/parity-coastal-shirt', expected: brand.storefront ? 200 : 404 },
		{ id: 'search', path: '/search?q=shirt', expected: brand.storefront ? 200 : 404 },
		{ id: 'locator', path: '/store-locator', expected: 200 },
		{ id: 'error-404', path: '/__runtime-parity-missing__', expected: 404 },
	];
}

async function captureSide(browserInstance, side, baseUrl, brandId, brand, routes) {
	const cells = new Map();
	for (const [viewportName, viewport] of Object.entries(viewports)) {
		const context = await browserInstance.newContext({ viewport, deviceScaleFactor: 1 });
		let blockedModelRequests = 0;
		await context.route('**/*', async (route) => {
			const requestUrl = new URL(route.request().url());
			const ownOrigin = new URL(baseUrl).origin;
			if (requestUrl.origin !== ownOrigin && !requestUrl.protocol.startsWith('data')) return route.abort('blockedbyclient');
			if (/^\/api\/(layout(?:\/stream)?|refine|suggest)$/.test(requestUrl.pathname)) {
				blockedModelRequests++;
				return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"blocked by parity harness"}' });
			}
			return route.continue();
		});

		for (const route of routes) {
			const page = await context.newPage();
			const blockedBefore = blockedModelRequests;
			const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
			const status = response?.status() ?? 0;
			await settlePage(page);
			const metrics = await collectMetrics(page, brand.name);
			metrics.structureHash = sha256(JSON.stringify(metrics.structureTokens));
			metrics.textHash = sha256(metrics.visibleText);
			delete metrics.structureTokens;
			delete metrics.visibleText;

			const directory = path.join(outputRoot, side, brandId, viewportName);
			fs.mkdirSync(directory, { recursive: true });
			const screenshot = path.join(directory, `${route.id}.png`);
			await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' });

			const zoneScreenshots = [];
			if (side === 'candidate') {
				for (const element of await page.locator('[data-runtime-zone]').all()) {
					const zoneId = await element.getAttribute('data-runtime-zone');
					if (!zoneId || !await element.isVisible()) continue;
					const zonePath = path.join(directory, `${route.id}--zone-${safeName(zoneId)}.png`);
					await element.screenshot({ path: zonePath, animations: 'disabled' });
					zoneScreenshots.push({ zoneId, path: zonePath });
				}
			}

			const tokenFingerprintVerified = ['primary', 'secondary', 'accent'].every((key) =>
				metrics.tokens[key].toLowerCase() === brand[key]);
			const activeBrandVerified = side === 'candidate'
				? metrics.activeBrandId === brandId && tokenFingerprintVerified
				: metrics.bodyTextIncludesBrand && tokenFingerprintVerified;
			if (side === 'candidate' && status !== route.expected) manifest.mechanicalFailures.push(`${side}/${brandId}/${viewportName}/${route.id}: status ${status}, expected ${route.expected}`);
			if (!activeBrandVerified) manifest.mechanicalFailures.push(`${side}/${brandId}/${viewportName}/${route.id}: active brand not verified`);
			if (side === 'candidate') validateCellZones(brandId, route, metrics, zoneScreenshots);

			cells.set(`${viewportName}/${route.id}`, {
				side, brandId, viewport: viewportName, dimensions: viewport, routeId: route.id, path: route.path,
				expectedStatus: route.expected, status, activeBrandVerified, blockedModelRequests: blockedModelRequests - blockedBefore,
				screenshot, materializedZoneScreenshots: zoneScreenshots, metrics,
			});
			await page.close();
		}
		await context.close();
	}
	return cells;
}

async function settlePage(page) {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.race([
			Promise.all([...document.images].map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => {
				image.addEventListener('load', resolve, { once: true });
				image.addEventListener('error', resolve, { once: true });
			}))),
			new Promise((resolve) => setTimeout(resolve, 2_000)),
		]);
	});
	await page.waitForTimeout(400);
}

async function collectMetrics(page, expectedBrandName) {
	return page.evaluate(({ expectedBrandName }) => {
		const root = document.querySelector('[data-brand-id]');
		const themeRoot = document.querySelector('[style*="--color-primary"]') ?? root ?? document.documentElement;
		const rootStyle = getComputedStyle(themeRoot);
		const bodyStyle = getComputedStyle(document.body);
		const zoneExecutions = [...document.querySelectorAll('[data-zone-execution]')].flatMap((element) => {
			try { return JSON.parse(element.getAttribute('data-zone-execution') ?? '[]'); } catch { return []; }
		});
		const structureTokens = [...document.querySelectorAll('body *')].map((element) => [
			element.tagName.toLowerCase(), element.getAttribute('role') ?? '', element.getAttribute('aria-label') ?? '',
			element.getAttribute('data-runtime-zone') ?? '', element.getAttribute('data-zone-source') ?? '',
			element.id, [...element.classList].sort().join('.'),
		].join('|'));
		const jsonLdTypes = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((node) => {
			try {
				const value = JSON.parse(node.textContent ?? '{}');
				return Array.isArray(value) ? value.map((item) => item?.['@type']).filter(Boolean) : [value?.['@type']].filter(Boolean);
			} catch { return []; }
		});
		const bodyText = (document.body.innerText ?? '').replace(/\s+/g, ' ').trim();
		return {
			title: document.title,
			activeBrandId: root?.getAttribute('data-brand-id') ?? null,
			activeBrandMode: root?.getAttribute('data-brand-mode') ?? null,
			bodyTextIncludesBrand: bodyText.toLowerCase().includes(expectedBrandName.toLowerCase()),
			bodySize: { width: document.body.scrollWidth, height: document.body.scrollHeight },
			chrome: {
				header: document.querySelectorAll('header').length, nav: document.querySelectorAll('nav').length,
				main: document.querySelectorAll('main').length, footer: document.querySelectorAll('footer').length,
			},
			content: {
				h1: [...document.querySelectorAll('h1')].map((node) => node.textContent?.trim()),
				headings: document.querySelectorAll('h1,h2,h3').length,
				sections: document.querySelectorAll('section').length,
				productLinks: document.querySelectorAll('a[href^="/product/"]').length,
				commerceJsonLdTypes: jsonLdTypes,
			},
			tokens: {
				primary: rootStyle.getPropertyValue('--color-primary').trim(),
				secondary: rootStyle.getPropertyValue('--color-secondary').trim(),
				accent: rootStyle.getPropertyValue('--color-accent').trim(),
				bodyFont: bodyStyle.fontFamily,
				bodyColor: bodyStyle.color,
				bodyBackground: bodyStyle.backgroundColor,
			},
			runtimeZones: [...document.querySelectorAll('[data-runtime-zone]')].map((element) => ({
				zoneId: element.getAttribute('data-runtime-zone'), source: element.getAttribute('data-zone-source'),
				terminal: element.getAttribute('data-zone-terminal'),
			})),
			emptyStateMarkers: [...document.querySelectorAll('[data-empty-state]')]
				.map((element) => element.getAttribute('data-empty-state')).filter(Boolean),
			zoneExecutions,
			structureTokens,
			visibleText: bodyText,
		};
	}, { expectedBrandName });
}

function validateCellZones(brandId, route, metrics, zoneScreenshots) {
	const executions = metrics.zoneExecutions;
	if (route.expected === 200) {
		const expectedRouteId = routeContractId(route.id);
		const pageExecution = executions.find((execution) => execution.routeId === expectedRouteId);
		if (!pageExecution) manifest.mechanicalFailures.push(`candidate/${brandId}/${route.id}: page zone execution missing`);
		if (executions.some((execution) => execution.surface === 'error-404')) {
			manifest.mechanicalFailures.push(`candidate/${brandId}/${route.id}: successful route emitted 404-zone execution`);
		}
		const emptyExecutions = executions.filter((execution) => execution.surface === 'error-empty');
		if (emptyExecutions.length > 0 && metrics.emptyStateMarkers.length === 0) {
			manifest.mechanicalFailures.push(`candidate/${brandId}/${route.id}: empty-zone execution lacks a rendered empty state`);
		}
	}
	if (route.expected === 404 && !executions.some((execution) => execution.routeId === '/+error' && execution.surface === 'error-404')) {
		manifest.mechanicalFailures.push(`candidate/${brandId}/${route.id}: actual 404 rescue-zone execution missing`);
	}
	for (const execution of executions) {
		if (execution.brandId !== brandId || execution.organizationId !== 'example-merchant') {
			manifest.mechanicalFailures.push(`candidate/${brandId}/${route.id}: zone provenance mismatch`);
		}
		if (execution.expectedZoneIds.length !== execution.decisions.length) {
			manifest.mechanicalFailures.push(`candidate/${brandId}/${route.id}: incomplete zone terminals`);
		}
		for (const decision of execution.decisions) {
			if (!['hidden', 'materialized-fallback', 'materialized-admin', 'materialized-engine'].includes(decision.terminal)
				|| decision.referenceState !== 'uncontracted') {
				manifest.mechanicalFailures.push(`candidate/${brandId}/${route.id}/${decision.zoneId}: invalid terminal/provenance`);
			}
			if (decision.terminal !== 'hidden' && !zoneScreenshots.some((capture) => capture.zoneId === decision.zoneId)) {
				manifest.mechanicalFailures.push(`candidate/${brandId}/${route.id}/${decision.zoneId}: materialized terminal lacks rendered capture`);
			}
		}
	}
}

function routeContractId(routeId) {
	return ({ home: '/', account: '/account', cart: '/cart', category: '/category/[slug]', checkout: '/checkout', compare: '/compare', product: '/product/[slug]', search: '/search', locator: '/store-locator' })[routeId] ?? '/+error';
}

function compareScreenshots(baseline, candidate, diff) {
	fs.mkdirSync(path.dirname(diff), { recursive: true });
	const result = spawnSync('magick', ['compare', '-metric', 'AE', baseline, candidate, diff], { encoding: 'utf8' });
	if (![0, 1].includes(result.status ?? -1)) throw new Error(`ImageMagick compare failed: ${result.stderr || result.stdout}`);
	const changedPixels = Number.parseFloat(String(result.stderr || result.stdout).trim());
	if (!Number.isFinite(changedPixels)) throw new Error(`Unable to parse ImageMagick AE metric: ${result.stderr}`);
	const dimensions = spawnSync('magick', ['identify', '-format', '%w %h', candidate], { encoding: 'utf8' });
	if (dimensions.status !== 0) throw new Error(`ImageMagick identify failed: ${dimensions.stderr}`);
	const [width, height] = dimensions.stdout.trim().split(/\s+/).map(Number);
	return { path: diff, changedPixels, candidatePixels: width * height, changedRatio: changedPixels / (width * height), review: changedPixels ? 'human-review-required' : 'no-pixel-delta' };
}

function compareRecordedMetrics(baseline, candidate) {
	const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
	return {
		bodySizeEqual: equal(baseline.bodySize, candidate.bodySize),
		chromeEqual: equal(baseline.chrome, candidate.chrome),
		contentAndCommerceMetadataEqual: equal(baseline.content, candidate.content),
		designTokensEqual: equal(baseline.tokens, candidate.tokens),
		componentTreeEqual: baseline.structureHash === candidate.structureHash,
		visibleCopyEqual: baseline.textHash === candidate.textHash,
		brandModeEqual: baseline.activeBrandMode === candidate.activeBrandMode,
	};
}

function prepareBaselineWorktree() {
	if (fs.existsSync(baselineRoot)) throw new Error(`refusing existing baseline path ${baselineRoot}`);
	runGit(['cat-file', '-e', `${PINNED_PRISTINE_MAIN}^{commit}`]);
	const added = spawnSync('git', ['-C', canonicalRoot, 'worktree', 'add', '--detach', baselineRoot, PINNED_PRISTINE_MAIN], { encoding: 'utf8' });
	if (added.status !== 0) throw new Error(`baseline worktree creation failed: ${added.stderr}`);
	fs.symlinkSync(path.join(candidateRoot, 'node_modules'), path.join(baselineRoot, 'node_modules'), 'dir');
	const fixtureSource = fs.readFileSync(path.join(candidateRoot, 'src/lib/server/parity-fixture.ts'), 'utf8');
	fs.writeFileSync(path.join(baselineRoot, 'src/lib/server/parity-fixture.ts'), fixtureSource);
	const bcPath = path.join(baselineRoot, 'src/lib/server/bigcommerce.ts');
	let source = fs.readFileSync(bcPath, 'utf8');
	source = replaceOnce(source, "import { getBrand } from '$lib/brand/config';", "import { getBrand } from '$lib/brand/config';\nimport { isParityFixtureEnabled, parityBCProducts, parityCategories } from './parity-fixture';");
	source = replaceOnce(source, 'export async function getProducts(limit = 30): Promise<BCProduct[]> {', 'export async function getProducts(limit = 30): Promise<BCProduct[]> {\n\tif (isParityFixtureEnabled()) return parityBCProducts().slice(0, limit);');
	source = replaceOnce(source, 'export async function getProductsByCategory(categoryEntityId: number): Promise<{ category: { name: string; description: string }; products: BCProduct[] }> {', "export async function getProductsByCategory(categoryEntityId: number): Promise<{ category: { name: string; description: string }; products: BCProduct[] }> {\n\tif (isParityFixtureEnabled()) {\n\t\tconst category = parityCategories().find((candidate) => candidate.entityId === categoryEntityId);\n\t\tif (!category) throw new Error(`Category ${categoryEntityId} not found`);\n\t\treturn { category: { name: category.name, description: '' }, products: parityBCProducts() };\n\t}");
	source = replaceOnce(source, "\tconst fullPath = path.startsWith('/') ? path : `/${path}/`;", "\tconst fullPath = path.startsWith('/') ? path : `/${path}/`;\n\tif (isParityFixtureEnabled()) {\n\t\tconst normalized = `/${fullPath.replace(/^\\/+|\\/+$/g, '')}/`;\n\t\treturn parityBCProducts().find((product) => product.path === normalized) ?? null;\n\t}");
	source = replaceOnce(source, '\tif (entityIds.length === 0) return [];', "\tif (entityIds.length === 0) return [];\n\tif (isParityFixtureEnabled()) {\n\t\tconst ids = new Set(entityIds);\n\t\treturn parityBCProducts().filter((product) => ids.has(product.entityId));\n\t}");
	source = replaceOnce(source, 'export async function getProductByEntityId(entityId: number): Promise<BCProduct | null> {', 'export async function getProductByEntityId(entityId: number): Promise<BCProduct | null> {\n\tif (isParityFixtureEnabled()) return parityBCProducts().find((product) => product.entityId === entityId) ?? null;');
	source = replaceOnce(source, 'export async function getCategories() {', 'export async function getCategories() {\n\tif (isParityFixtureEnabled()) return parityCategories();');
	fs.writeFileSync(bcPath, source);
}

async function startServer(side, root, brandId, port) {
	const logPath = path.join(outputRoot, 'logs', `${side}-${brandId}.log`);
	fs.mkdirSync(path.dirname(logPath), { recursive: true });
	const log = fs.createWriteStream(logPath, { flags: 'w' });
	const child = spawn(process.execPath, [viteBin, 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
		cwd: root,
			env: {
			...process.env,
			BRAND_ID: brandId, VITE_BRAND_ID: brandId, AISLES_PARITY_FIXTURE: 'v1', AISLES_ROUTE_BINDING_SECRET: LOCAL_ROUTE_SECRET,
			AISLES_NO_CACHE: '1', AISLES_ZONE_CONTENT_SCHEMA_VERSION: '',
			BIGCOMMERCE_STORE_HASH: '', BIGCOMMERCE_STOREFRONT_TOKEN: '', STOREFRONT_TOKEN: '',
			BEALLS_STOREFRONT_TOKEN: '', BEALLSFLORIDA_STOREFRONT_TOKEN: '',
			AI_GATEWAY_API_KEY: '', VERCEL_AI_GATEWAY_API_KEY: '', VERCEL_OIDC_TOKEN: '',
			ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', OPENROUTER_API_KEY: '',
			DATABASE_URL: '', POSTGRES_URL: '', NEON_DATABASE_URL: '', KV_REST_API_URL: '', KV_REST_API_TOKEN: '',
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	child.stdout.pipe(log);
	child.stderr.pipe(log);
	const baseUrl = `http://127.0.0.1:${port}`;
	for (let attempt = 0; attempt < 120; attempt++) {
		if (child.exitCode !== null) throw new Error(`${side}/${brandId} server exited; see ${logPath}`);
		try {
			const response = await fetch(baseUrl);
			if (response.status > 0) return { child, log, logPath, baseUrl };
		} catch { /* retry */ }
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error(`${side}/${brandId} server did not become ready; see ${logPath}`);
}

async function stopServer(server) {
	if (!server) return;
	if (server.child.exitCode === null) server.child.kill('SIGTERM');
	await Promise.race([
		new Promise((resolve) => server.child.once('exit', resolve)),
		new Promise((resolve) => setTimeout(resolve, 3_000)),
	]);
	server.log.end();
}

function removeBaselineWorktree() {
	if (!fs.existsSync(baselineRoot)) return;
	const result = spawnSync('git', ['-C', canonicalRoot, 'worktree', 'remove', '--force', baselineRoot], { encoding: 'utf8' });
	if (result.status !== 0) console.error(`warning: baseline worktree cleanup failed: ${result.stderr}`);
}

function hashBaselineOverlay() {
	return sha256(fs.readFileSync(path.join(baselineRoot, 'src/lib/server/parity-fixture.ts'))
		+ fs.readFileSync(path.join(baselineRoot, 'src/lib/server/bigcommerce.ts')));
}

function writeManifest() {
	fs.mkdirSync(outputRoot, { recursive: true });
	fs.writeFileSync(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

function replaceOnce(source, needle, replacement) {
	const index = source.indexOf(needle);
	if (index < 0 || source.indexOf(needle, index + needle.length) >= 0) throw new Error(`baseline overlay anchor is missing or ambiguous: ${needle.slice(0, 80)}`);
	return source.slice(0, index) + replacement + source.slice(index + needle.length);
}

function runGit(args, cwd = candidateRoot) {
	const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
	if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
	return result.stdout.trim();
}

function diffPath(brandId, key) {
	const [viewport, route] = key.split('/');
	return path.join(outputRoot, 'diff', brandId, viewport, `${route}.png`);
}

function safeName(value) {
	return value.replace(/[^a-z0-9.-]+/gi, '-');
}

function sha256(value) {
	return createHash('sha256').update(value).digest('hex');
}

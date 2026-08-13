import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBrandId } from '../brand/config';
import {
	artifactIdentity,
	assertArtifactIdentity,
	assertAttestableSourceStatus,
	assertRemoteWorkerInventory,
	deriveBuildIdentity,
} from './cloudflare-preview-release-gates';

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');
const config = JSON.parse(read('wrangler.jsonc'));
const packageJson = JSON.parse(read('package.json'));
const wrapper = read('scripts/cloudflare-current-preview.mjs');
const releaseGates = read('src/lib/server/cloudflare-preview-release-gates.ts');
const svelteConfig = read('svelte.config.js');
const layout = read('src/routes/+layout.svelte');

let failures = 0;
function assert(name: string, condition: boolean, detail = ''): void {
	if (condition) console.log(`PASS  ${name}`);
	else {
		console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
		failures++;
	}
}

function rejects(name: string, fn: () => unknown, pattern: RegExp): void {
	try {
		fn();
		assert(name, false, 'did not throw');
	} catch (error) {
		assert(name, pattern.test(error instanceof Error ? error.message : String(error)));
	}
}

const expected = {
	bealls: 'aisles-bealls-current-preview',
	homecentric: 'aisles-homecentric-current-preview',
	beallsflorida: 'aisles-beallsflorida-current-preview',
};

assert('Cloudflare adapter is explicit while Vercel remains the default',
	packageJson.devDependencies['@sveltejs/adapter-cloudflare']
	&& packageJson.devDependencies['@sveltejs/adapter-vercel']
	&& svelteConfig.includes("process.env.AISLES_ADAPTER || 'vercel'")
	&& svelteConfig.includes("adapterTarget === 'cloudflare' ? cloudflareAdapter() : vercelAdapter()"));
assert('unknown hosting adapters fail closed',
	svelteConfig.includes('Unknown AISLES_ADAPTER'));
assert('package commands share the guarded Cloudflare wrapper',
	['build', 'verify', 'deploy', 'smoke'].every((action) =>
		packageJson.scripts[`${action}:cloudflare`] === `tsx scripts/cloudflare-current-preview.mjs ${action}`));

assert('Wrangler config uses a current Workers runtime and observable logs',
	config.compatibility_date === '2026-08-13'
	&& config.compatibility_flags.includes('nodejs_compat')
	&& config.observability?.enabled === true
	&& config.observability?.logs?.enabled === true);
assert('bare deploy target fails its brand binding and per-brand Workers are separate',
	config.account_id === 'b6ffcf200d56bab5749e243f024658d2'
	&& config.name === 'aisles-current-preview-inert'
	&& config.vars?.BRAND_ID === '__deploy_requires_named_env__'
	&& Object.keys(config.env).sort().join(',') === Object.keys(expected).sort().join(',')
	&& Object.entries(expected).every(([brandId, worker]) => config.env[brandId]?.name === worker));
assert('each Worker binds the exact brand and no-paid fixture profile',
	Object.keys(expected).every((brandId) => {
		const vars = config.env[brandId].vars;
		return Object.keys(vars).sort().join(',') === 'AISLES_HOSTING_PROFILE,AISLES_PARITY_FIXTURE,BRAND_ID'
			&& vars.BRAND_ID === brandId
			&& vars.AISLES_PARITY_FIXTURE === 'v1'
			&& vars.AISLES_HOSTING_PROFILE === 'current-main-preview-v1';
	}));
assert('Sleep Country is excluded from the current-main hosting config',
	!read('wrangler.jsonc').toLowerCase().includes('sleepcountry'));

const forbiddenConfigKeys = [
	'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'AI_GATEWAY_API_KEY',
	'CF_AIG_GATEWAY_ID', 'DATABASE_URL', 'KV_REST_API_TOKEN',
	'BIGCOMMERCE_ACCESS_TOKEN', 'STOREFRONT_TOKEN',
];
assert('Wrangler config contains no provider, backend, or catalog credentials',
	forbiddenConfigKeys.every((key) => !read('wrangler.jsonc').includes(key)));
assert('build and deployment children strip application credentials',
	['ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'DATABASE_URL', 'KV_REST_API_TOKEN', 'BIGCOMMERCE_STORE_HASH',
		'VERCEL_OIDC_TOKEN', 'AISLES_OBSERVER_KEY', 'AISLES_REVIEW_TOKEN']
		.every((key) => wrapper.includes(`'${key}'`))
	&& wrapper.includes('for (const key of strippedApplicationSecrets) delete env[key]'));
assert('build receipt binds compiled brand, Worker, environment, fixture, and source commit',
	['brandId', 'wranglerEnvironment', 'worker', 'fixture', 'gitCommit', 'deployableArtifact', 'adapterInputs', 'buildIdentity', 'wranglerDryRunArtifact']
		.every((field) => wrapper.includes(field))
	&& wrapper.includes('assertReceipt(brandId, brand)')
	&& wrapper.includes('assertArtifactIdentity(receipt.deployableArtifact'));
assert('generated Wrangler config uses paths relative to its own directory',
	wrapper.includes("main: '../../.svelte-kit/cloudflare/_worker.js'")
	&& wrapper.includes("directory: '../../.svelte-kit/cloudflare'")
	&& !wrapper.includes("tsconfig: path.resolve(root, base.tsconfig)"));
assert('deploy account and remote inventory are fail-closed before mutation',
	wrapper.includes("const intendedCloudflareAccountId = 'b6ffcf200d56bab5749e243f024658d2'")
	&& wrapper.indexOf('await preflightRemoteWorker(brandId, brand)') < wrapper.lastIndexOf("run('npx', ['wrangler', 'deploy'")
	&& wrapper.includes("['deployments', 'status'")
	&& wrapper.includes("['secret', 'list'")
	&& wrapper.includes("['versions', 'view'")
	&& releaseGates.includes('undeclared binding'));
assert('deploy uses strict binding replacement after remote fail-closed inventory',
	wrapper.includes("['wrangler', 'deploy', '--strict'"));
assert('live smoke binds fresh receipt identity and proves bounded policy modes',
	wrapper.includes("home.headers.get('x-aisles-build-id') === receipt.buildIdentity")
	&& wrapper.includes("home.headers.get('x-aisles-source-commit') === receipt.gitCommit")
	&& wrapper.includes("'pdp.below-description': 'fixed'")
	&& wrapper.includes("'pdp.related': 'rules'")
	&& wrapper.includes("'plp.banner': 'fixed'")
	&& wrapper.includes("'search.empty-state': 'fixed'"));
assert('promotion order is mechanical',
	wrapper.includes("brandId === 'homecentric'")
	&& wrapper.includes("AISLES_BEALLS_PREVIEW_VERIFIED !== 'v1'")
	&& wrapper.includes("brandId === 'beallsflorida'")
	&& wrapper.includes('catalog and channel validity'));
assert('shopper bundle verification scans for every retired client endpoint',
	['/api/layout', '/api/refine', '/api/suggest'].every((endpoint) => wrapper.includes(`'${endpoint}'`))
	&& wrapper.includes('Shopper client bundle references retired endpoints'));
assert('active brand remains directly observable in shopper HTML',
	layout.includes('data-brand-id={data.brand?.id'));
assert('server responses expose the exact brand, fixture, profile, and zero model authority',
	read('src/hooks.server.ts').includes("response.headers.set('x-aisles-brand-id', brand.id)")
	&& read('src/hooks.server.ts').includes("response.headers.set('x-aisles-catalog-mode', 'parity-fixture-v1')")
	&& read('src/hooks.server.ts').includes("response.headers.set('x-aisles-shopper-model-authority', 'none')"));
assert('the retired refinement component is not mounted by a shopper surface',
	!read('src/routes/+layout.svelte').includes('RefinementChat')
	&& !read('src/routes/+page.svelte').includes('RefinementChat')
	&& !read('src/routes/category/[slug]/+page.svelte').includes('RefinementChat')
	&& !read('src/routes/product/[slug]/+page.svelte').includes('RefinementChat'));

assert('registered deployment brands resolve exactly',
	Object.keys(expected).every((brandId) => resolveBrandId(brandId).id === brandId));
rejects('unknown deployment brand IDs fail closed', () => resolveBrandId('sleepcountry'), /Unknown BRAND_ID/);
rejects('prototype-derived brand IDs fail closed', () => resolveBrandId('__proto__'), /Unknown BRAND_ID/);

const artifactRoot = mkdtempSync(join(tmpdir(), 'aisles-cloudflare-artifact-'));
try {
	mkdirSync(join(artifactRoot, 'chunks'));
	writeFileSync(join(artifactRoot, '_worker.js'), 'export default 1;');
	writeFileSync(join(artifactRoot, 'chunks', 'server.js'), 'export const brand = "bealls";');
	const identity = artifactIdentity(artifactRoot);
	assert('artifact identity covers all deployable files', identity.fileCount === 2 && identity.totalBytes > 20);
	writeFileSync(join(artifactRoot, 'chunks', 'server.js'), 'export const brand = "tampered";');
	rejects('post-build artifact tampering is rejected',
		() => assertArtifactIdentity(identity, artifactRoot, 'test artifact'), /changed after its receipt was written/);
	const baseReceipt = {
		schemaVersion: 'aisles-cloudflare-current-preview-build-v2', wranglerEnvironment: 'bealls',
		worker: 'aisles-bealls-current-preview', hostingProfile: 'current-main-preview-v1', fixture: 'v1',
		gitCommit: 'a'.repeat(40), deployableArtifact: identity,
	};
	assert('brand identity changes even when base output bytes are identical',
		deriveBuildIdentity({ ...baseReceipt, brandId: 'bealls' })
		!== deriveBuildIdentity({ ...baseReceipt, brandId: 'homecentric', wranglerEnvironment: 'homecentric', worker: 'aisles-homecentric-current-preview' }));
} finally {
	rmSync(artifactRoot, { recursive: true, force: true });
}

rejects('dirty tracked or untracked source cannot be attested',
	() => assertAttestableSourceStatus(' M src/hooks.server.ts\n?? untracked.txt'), /Refusing to attest dirty source/);
assertAttestableSourceStatus('');

const remoteBrand = { environment: 'bealls', worker: 'aisles-bealls-current-preview' };
assertRemoteWorkerInventory({ state: 'absent', secrets: [], versions: [] }, 'bealls', remoteBrand);
rejects('stale remote secrets block deployment inventory', () => assertRemoteWorkerInventory({
	state: 'present', secrets: [{ name: 'ANTHROPIC_API_KEY', type: 'secret_text' }], versions: [{ id: 'v1', bindings: [] }],
}, 'bealls', remoteBrand), /stale secrets/);
rejects('undeclared remote service bindings block deployment inventory', () => assertRemoteWorkerInventory({
	state: 'present', secrets: [], versions: [{ id: 'v1', bindings: [{ name: 'CATALOG', type: 'service' }] }],
}, 'bealls', remoteBrand), /undeclared binding CATALOG \(service\)/);

const originalHostingProfile = process.env.AISLES_HOSTING_PROFILE;
const originalBrandId = process.env.BRAND_ID;
const originalFixture = process.env.AISLES_PARITY_FIXTURE;
const originalBuildId = process.env.AISLES_BUILD_ID;
const originalSourceCommit = process.env.AISLES_SOURCE_COMMIT;
const { handle } = await import('../../hooks.server');
try {
	process.env.AISLES_HOSTING_PROFILE = 'current-main-preview-v1';
	process.env.BRAND_ID = 'sleepcountry';
	process.env.AISLES_PARITY_FIXTURE = 'v1';
	const unknownBinding = await handle({ event: {} as never, resolve: (() => new Response('unsafe')) as never });
	assert('unknown hosted BRAND_ID returns a closed response before route execution',
		unknownBinding.status === 503 && unknownBinding.headers.get('x-aisles-binding-status') === 'rejected');

	process.env.BRAND_ID = 'bealls';
	delete process.env.AISLES_PARITY_FIXTURE;
	const missingFixture = await handle({ event: {} as never, resolve: (() => new Response('unsafe')) as never });
	assert('current-main hosted preview rejects a missing fixture binding',
		missingFixture.status === 503 && missingFixture.headers.get('x-aisles-binding-status') === 'rejected');

	process.env.AISLES_PARITY_FIXTURE = 'v1';
	process.env.AISLES_BUILD_ID = 'b'.repeat(64);
	process.env.AISLES_SOURCE_COMMIT = 'c'.repeat(40);
	const validBinding = await handle({ event: {} as never, resolve: (() => new Response('safe')) as never });
	assert('valid hosted preview emits observable runtime proof',
		validBinding.status === 200
		&& validBinding.headers.get('x-aisles-brand-id') === 'bealls'
		&& validBinding.headers.get('x-aisles-catalog-mode') === 'parity-fixture-v1'
		&& validBinding.headers.get('x-aisles-shopper-model-authority') === 'none'
		&& validBinding.headers.get('x-aisles-build-id') === 'b'.repeat(64)
		&& validBinding.headers.get('x-aisles-source-commit') === 'c'.repeat(40));
} finally {
	if (originalHostingProfile === undefined) delete process.env.AISLES_HOSTING_PROFILE;
	else process.env.AISLES_HOSTING_PROFILE = originalHostingProfile;
	if (originalBrandId === undefined) delete process.env.BRAND_ID;
	else process.env.BRAND_ID = originalBrandId;
	if (originalFixture === undefined) delete process.env.AISLES_PARITY_FIXTURE;
	else process.env.AISLES_PARITY_FIXTURE = originalFixture;
	if (originalBuildId === undefined) delete process.env.AISLES_BUILD_ID;
	else process.env.AISLES_BUILD_ID = originalBuildId;
	if (originalSourceCommit === undefined) delete process.env.AISLES_SOURCE_COMMIT;
	else process.env.AISLES_SOURCE_COMMIT = originalSourceCommit;
}

const [layoutApi, streamApi, refineApi, suggestApi] = await Promise.all([
	import('../../routes/api/layout/+server'),
	import('../../routes/api/layout/stream/+server'),
	import('../../routes/api/refine/+server'),
	import('../../routes/api/suggest/+server'),
]);
const [layoutResponse, streamResponse, refineResponse, suggestResponse] = await Promise.all([
	layoutApi.POST({} as never),
	streamApi.POST({} as never),
	refineApi.POST({} as never),
	suggestApi.POST({} as never),
]);
assert('retired endpoints keep their mechanical status boundary',
	layoutResponse.status === 403
	&& streamResponse.status === 410
	&& refineResponse.status === 403
	&& suggestResponse.status === 403);
assert('layout rejection still proves no model call',
	(await layoutResponse.json()).meta?.modelCalled === false);

if (failures) throw new Error(`${failures} Cloudflare current-preview contract test(s) failed`);

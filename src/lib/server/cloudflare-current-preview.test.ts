import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBrandId } from '../brand/config';

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');
const config = JSON.parse(read('wrangler.jsonc'));
const packageJson = JSON.parse(read('package.json'));
const wrapper = read('scripts/cloudflare-current-preview.mjs');
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
		packageJson.scripts[`${action}:cloudflare`] === `node scripts/cloudflare-current-preview.mjs ${action}`));

assert('Wrangler config uses a current Workers runtime and observable logs',
	config.compatibility_date === '2026-08-13'
	&& config.compatibility_flags.includes('nodejs_compat')
	&& config.observability?.enabled === true
	&& config.observability?.logs?.enabled === true);
assert('bare deploy target fails its brand binding and per-brand Workers are separate',
	config.name === 'aisles-current-preview-inert'
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
	'BIGCOMMERCE_ACCESS_TOKEN', 'STOREFRONT_TOKEN', 'account_id',
];
assert('Wrangler config contains no provider, backend, account, or catalog credentials',
	forbiddenConfigKeys.every((key) => !read('wrangler.jsonc').includes(key)));
assert('build and deployment children strip application credentials',
	['ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'DATABASE_URL', 'KV_REST_API_TOKEN', 'BIGCOMMERCE_STORE_HASH']
		.every((key) => wrapper.includes(`'${key}'`))
	&& wrapper.includes('for (const key of strippedApplicationSecrets) delete env[key]'));
assert('build receipt binds compiled brand, Worker, environment, fixture, and source commit',
	['brandId', 'wranglerEnvironment', 'worker', 'fixture', 'gitCommit', 'workerSha256']
		.every((field) => wrapper.includes(field))
	&& wrapper.includes('assertReceipt(brandId, brand)'));
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

const originalHostingProfile = process.env.AISLES_HOSTING_PROFILE;
const originalBrandId = process.env.BRAND_ID;
const originalFixture = process.env.AISLES_PARITY_FIXTURE;
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
	const validBinding = await handle({ event: {} as never, resolve: (() => new Response('safe')) as never });
	assert('valid hosted preview emits observable runtime proof',
		validBinding.status === 200
		&& validBinding.headers.get('x-aisles-brand-id') === 'bealls'
		&& validBinding.headers.get('x-aisles-catalog-mode') === 'parity-fixture-v1'
		&& validBinding.headers.get('x-aisles-shopper-model-authority') === 'none');
} finally {
	if (originalHostingProfile === undefined) delete process.env.AISLES_HOSTING_PROFILE;
	else process.env.AISLES_HOSTING_PROFILE = originalHostingProfile;
	if (originalBrandId === undefined) delete process.env.BRAND_ID;
	else process.env.BRAND_ID = originalBrandId;
	if (originalFixture === undefined) delete process.env.AISLES_PARITY_FIXTURE;
	else process.env.AISLES_PARITY_FIXTURE = originalFixture;
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

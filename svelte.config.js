import cloudflareAdapter from '@sveltejs/adapter-cloudflare';
import vercelAdapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const adapterTarget = process.env.AISLES_ADAPTER || 'vercel';
if (adapterTarget !== 'vercel' && adapterTarget !== 'cloudflare') {
	throw new Error(`Unknown AISLES_ADAPTER "${adapterTarget}". Expected "vercel" or "cloudflare".`);
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Vercel remains the default. The bounded Cloudflare preview command
		// selects its adapter explicitly so one build artifact cannot be reused
		// accidentally across hosting targets.
		adapter: adapterTarget === 'cloudflare' ? cloudflareAdapter() : vercelAdapter()
	}
};

export default config;

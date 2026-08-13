import type { Handle } from '@sveltejs/kit';
import { getBrand, resolveBrandId } from './lib/brand/config';

const CLOUDFLARE_PREVIEW_PROFILE = 'current-main-preview-v1';

export const handle: Handle = async ({ event, resolve }) => {
	let brand;
	try {
		brand = getBrand();
	} catch {
		return rejectedBinding('unknown');
	}

	const hostingProfile = process.env.AISLES_HOSTING_PROFILE;
	if (hostingProfile === CLOUDFLARE_PREVIEW_PROFILE) {
		const runtimeBrandId = process.env.BRAND_ID;
		let runtimeBrand;
		try {
			runtimeBrand = resolveBrandId(runtimeBrandId);
		} catch {
			return rejectedBinding('unknown');
		}
		if (runtimeBrandId === undefined || runtimeBrand.id !== brand.id) {
			return rejectedBinding(runtimeBrand.id);
		}
		if (process.env.AISLES_PARITY_FIXTURE !== 'v1') {
			return rejectedBinding(runtimeBrand.id);
		}
		if (!/^[a-f0-9]{64}$/.test(process.env.AISLES_BUILD_ID ?? '')
			|| !/^[a-f0-9]{40}$/.test(process.env.AISLES_SOURCE_COMMIT ?? '')) {
			return rejectedBinding(runtimeBrand.id);
		}
	}

	const response = await resolve(event);
	response.headers.set('x-aisles-brand-id', brand.id);
	response.headers.set('x-aisles-shopper-model-authority', 'none');
	if (hostingProfile === CLOUDFLARE_PREVIEW_PROFILE) {
		response.headers.set('x-aisles-hosting-profile', hostingProfile);
		response.headers.set('x-aisles-catalog-mode', 'parity-fixture-v1');
		response.headers.set('x-aisles-build-id', process.env.AISLES_BUILD_ID!);
		response.headers.set('x-aisles-source-commit', process.env.AISLES_SOURCE_COMMIT!);
	}
	return response;
};

function rejectedBinding(runtimeBrandId: string): Response {
	return new Response('Cloudflare preview brand binding rejected', {
		status: 503,
		headers: {
			'cache-control': 'no-store',
			'x-aisles-brand-id': runtimeBrandId,
			'x-aisles-hosting-profile': CLOUDFLARE_PREVIEW_PROFILE,
			'x-aisles-binding-status': 'rejected',
		},
	});
}

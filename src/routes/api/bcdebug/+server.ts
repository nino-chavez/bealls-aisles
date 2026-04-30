import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getBrand, getBrandMode } from '$lib/brand/config';

export const GET = async () => {
	const brand = getBrand();
	const tokenKey = `${brand.id.toUpperCase()}_STOREFRONT_TOKEN`;
	const tok = env[tokenKey] || env.BIGCOMMERCE_STOREFRONT_TOKEN || null;
	return json({
		brandId: brand.id,
		brandName: brand.name,
		mode: getBrandMode(brand),
		bcChannelId: brand.bc.channelId,
		envBrandId: env.BRAND_ID,
		tokenKey,
		tokenPresent: !!tok,
		tokenFirst30: tok ? tok.slice(0, 30) : null,
		tokenLength: tok?.length ?? 0,
	});
};

import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';

function bearer(request: Request): string | null {
	const value = request.headers.get('authorization');
	return value?.startsWith('Bearer ') ? value.slice(7) : null;
}

export function requireOperatorAccess(url: URL, request: Request): void {
	const configured = env.OBSERVE_ACCESS_TOKEN;
	const supplied = bearer(request) ?? url.searchParams.get('key');
	const allowed = configured ? supplied === configured : dev && supplied === 'aisles-observe';
	if (!allowed) throw error(401, 'Operator authorization required');
}

export function requireMerchantReviewAccess(url: URL, request: Request): void {
	if (dev) return;
	const configured = env.MERCHANT_REVIEW_ACCESS_TOKEN;
	const supplied = bearer(request) ?? url.searchParams.get('review');
	if (!configured || supplied !== configured) throw error(404, 'Not found');
}

export function requireDevelopmentRoute(): void {
	if (!dev) throw error(404, 'Not found');
}

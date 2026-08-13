import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';
import {
	normalizeTrustedShopperRequest,
	normalizeTrustedShopperRoute,
	compileBrandCompositionPolicy,
	trustedModelZoneApiContext,
	type BeallsFamilyBrandId,
	type TrustedShopperRouteContext,
} from '$lib/brand/bealls-family-runtime-contract';
import {
	issueShopperRouteGrant,
	shopperRouteGrantCookieName,
	verifyShopperRouteGrant,
	type ShopperRouteGrantScope,
} from '$lib/foundation/shopper-route-grant';
import { PARITY_FIXTURE_VERSION } from './parity-fixture';

const BINDING_SESSION_COOKIE = 'aisles_route_binding_session';

/** Page URL is the authority that issues a server-signed, HttpOnly route grant. */
export function bindShopperRouteGrant(pathname: string, brandId: BeallsFamilyBrandId, cookies: Cookies): void {
	const secret = env.AISLES_ROUTE_BINDING_SECRET;
	if (!secret) return;
	let context: TrustedShopperRouteContext;
	try {
		context = trustedModelZoneApiContext(normalizeTrustedShopperRoute(brandId, pathname));
	} catch {
		return;
	}
	const sessionId = getOrCreateBindingSession(cookies);
	const scope = createRouteGrantScope(context, sessionId);
	cookies.set(shopperRouteGrantCookieName(context.routePath), issueShopperRouteGrant(scope, secret), {
		path: '/api', httpOnly: true, sameSite: 'strict', secure: !dev, maxAge: 10 * 60,
	});
}

/** Exact API authority = signed page grant plus matching Origin/Referer confusion checks. */
export function trustedShopperApiContext(request: Request, cookies: Cookies, brandId: BeallsFamilyBrandId): TrustedShopperRouteContext {
	const secret = env.AISLES_ROUTE_BINDING_SECRET;
	if (!secret) throw new Error('shopper route grant: AISLES_ROUTE_BINDING_SECRET is not configured');
	const hinted = trustedModelZoneApiContext(normalizeTrustedShopperRequest(request, brandId));
	const sessionId = cookies.get(BINDING_SESSION_COOKIE);
	if (!sessionId) throw new Error('shopper route grant: binding session is required');
	const token = cookies.get(shopperRouteGrantCookieName(hinted.routePath));
	if (!token) throw new Error('shopper route grant: signed consuming-route grant is required');
	verifyShopperRouteGrant(token, secret, createRouteGrantScope(hinted, sessionId));
	return hinted;
}

function getOrCreateBindingSession(cookies: Cookies): string {
	const existing = cookies.get(BINDING_SESSION_COOKIE);
	if (existing && /^[a-f0-9-]{36}$/.test(existing)) return existing;
	const sessionId = crypto.randomUUID();
	cookies.set(BINDING_SESSION_COOKIE, sessionId, {
		path: '/', httpOnly: true, sameSite: 'strict', secure: !dev, maxAge: 30 * 60,
	});
	return sessionId;
}

function createRouteGrantScope(context: TrustedShopperRouteContext, bindingSessionId: string): ShopperRouteGrantScope {
	const policy = compileBrandCompositionPolicy(context.brandId, context.surface);
	const fixture = env.AISLES_PARITY_FIXTURE === 'v1';
	return {
		version: 'shopper-route-grant-v1',
		bindingSessionId,
		organizationId: policy.provenance.organizationId,
		organizationPolicyVersion: policy.provenance.organizationPolicyVersion,
		brandId: context.brandId,
		brandPolicyVersion: policy.provenance.brandPolicyVersion,
		routeId: context.routeId,
		routePath: context.routePath,
		surface: context.surface,
		effectivePolicyVersion: policy.policyVersion,
		referenceState: policy.provenance.referenceState,
		referenceId: null,
		referenceVersion: null,
		catalogAuthorityVersion: fixture ? PARITY_FIXTURE_VERSION : 'live-catalog-provider-v1',
		syntheticProvenance: fixture ? 'parity-fixture-v1' : 'none',
	};
}

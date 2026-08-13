import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import type { BeallsFamilyBrandId } from '../brand/bealls-family-runtime-contract';

const GRANT_VERSION = 'shopper-route-grant-v1';
const GRANT_TTL_MS = 10 * 60 * 1_000;

export interface ShopperRouteGrantScope {
	version: typeof GRANT_VERSION;
	bindingSessionId: string;
	organizationId: string;
	organizationPolicyVersion: string;
	brandId: BeallsFamilyBrandId;
	brandPolicyVersion: string;
	routeId: string;
	routePath: string;
	surface: string;
	effectivePolicyVersion: string;
	referenceState: 'uncontracted';
	referenceId: null;
	referenceVersion: null;
	catalogAuthorityVersion: string;
	syntheticProvenance: 'none' | 'parity-fixture-v1';
}

interface ShopperRouteGrantPayload extends ShopperRouteGrantScope {
	issuedAt: number;
	expiresAt: number;
}

export function shopperRouteGrantCookieName(routePath: string): string {
	return `aisles_route_${createHash('sha256').update(routePath).digest('hex').slice(0, 16)}`;
}

export function issueShopperRouteGrant(scope: ShopperRouteGrantScope, secret: string, now = Date.now()): string {
	if (secret.length < 32) throw new Error('shopper route grant: signing secret must contain at least 32 characters');
	const payload: ShopperRouteGrantPayload = {
		...scope,
		issuedAt: now,
		expiresAt: now + GRANT_TTL_MS,
	};
	const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
	return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyShopperRouteGrant(
	token: string,
	secret: string,
	expected: ShopperRouteGrantScope,
	now = Date.now(),
): ShopperRouteGrantScope {
	if (secret.length < 32) throw new Error('shopper route grant: signing secret must contain at least 32 characters');
	const parts = token.split('.');
	if (parts.length !== 2) throw new Error('shopper route grant: malformed token');
	const [encoded, suppliedSignature] = parts;
	const supplied = Buffer.from(suppliedSignature, 'base64url');
	const wanted = Buffer.from(sign(encoded, secret), 'base64url');
	if (supplied.length !== wanted.length || !timingSafeEqual(supplied, wanted)) throw new Error('shopper route grant: invalid signature');
	let payload: ShopperRouteGrantPayload;
	try {
		payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ShopperRouteGrantPayload;
	} catch {
		throw new Error('shopper route grant: invalid payload');
	}
	if (payload.version !== GRANT_VERSION || !Number.isSafeInteger(payload.issuedAt) || !Number.isSafeInteger(payload.expiresAt)
		|| payload.issuedAt > now + 5_000 || payload.expiresAt <= now || payload.expiresAt - payload.issuedAt !== GRANT_TTL_MS) {
		throw new Error('shopper route grant: expired or invalid lifetime');
	}
	if (payload.bindingSessionId !== expected.bindingSessionId || payload.organizationId !== expected.organizationId
		|| payload.organizationPolicyVersion !== expected.organizationPolicyVersion || payload.brandId !== expected.brandId
		|| payload.brandPolicyVersion !== expected.brandPolicyVersion || payload.routeId !== expected.routeId
		|| payload.routePath !== expected.routePath || payload.surface !== expected.surface
		|| payload.effectivePolicyVersion !== expected.effectivePolicyVersion
		|| payload.referenceState !== expected.referenceState || payload.referenceId !== expected.referenceId
		|| payload.referenceVersion !== expected.referenceVersion
		|| payload.catalogAuthorityVersion !== expected.catalogAuthorityVersion
		|| payload.syntheticProvenance !== expected.syntheticProvenance) {
		throw new Error('shopper route grant: consuming route mismatch');
	}
	return expected;
}

function sign(encoded: string, secret: string): string {
	return createHmac('sha256', secret).update(encoded).digest('base64url');
}

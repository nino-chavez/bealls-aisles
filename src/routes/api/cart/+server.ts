import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireBrandSurface } from '$lib/server/brand-surface-guard';
import { getCommerceServiceBoundary, isCommerceEnabled } from '$lib/server/commerce/boundary';
import { commerceService } from '$lib/server/commerce/service';
import {
	CommerceRateLimitError,
	CommerceSessionUnavailableError,
	commerceSessionId,
	requireCommerceSessionId,
	requireCommerceMutationCapacity,
	requireIdempotencyKey,
	requireSameOrigin,
} from '$lib/server/commerce/session';
import { operationEvidence, type CommerceOperation } from '$lib/commerce/cart-contract';

export const GET: RequestHandler = async ({ cookies }) => {
	requireBrandSurface('cart');
	if (!isCommerceEnabled()) return disabled('cart.read');
	return commerceResponse(await commerceService.read(commerceSessionId(cookies)));
};

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	requireBrandSurface('cart');
	if (!isCommerceEnabled()) return disabled('cart.add');
	try {
		requireSameOrigin(request);
		const body = await request.json();
		const productEntityId = Number(body?.productEntityId);
		const quantity = body?.quantity === undefined ? 1 : Number(body.quantity);
		if (
			!Number.isInteger(productEntityId) ||
			productEntityId < 1 ||
			!Number.isInteger(quantity) ||
			quantity < 1 ||
			quantity > 10
		) {
			return invalid('cart.add', 'A valid product and quantity from 1 to 10 are required.');
		}
		await requireCommerceMutationCapacity(getClientAddress());
		return commerceResponse(
			await commerceService.add(
				requireCommerceSessionId(cookies),
				requireIdempotencyKey(request),
				{ productEntityId, quantity },
			),
		);
	} catch (cause) {
		return guardFailure('cart.add', cause, 'The cart request could not be read.');
	}
};

export const PATCH: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	requireBrandSurface('cart');
	if (!isCommerceEnabled()) return disabled('cart.update');
	try {
		requireSameOrigin(request);
		const body = await request.json();
		const lineId = typeof body?.lineItemEntityId === 'string' ? body.lineItemEntityId.trim() : '';
		const quantity = Number(body?.quantity);
		if (!lineId || !Number.isInteger(quantity) || quantity < 0 || quantity > 10) {
			return invalid('cart.update', 'A valid cart line and quantity from 0 to 10 are required.');
		}
		await requireCommerceMutationCapacity(getClientAddress());
		const sessionId = requireCommerceSessionId(cookies);
		const key = requireIdempotencyKey(request);
		return commerceResponse(
			quantity === 0
				? await commerceService.remove(sessionId, key, { lineId })
				: await commerceService.update(sessionId, key, { lineId, quantity }),
		);
	} catch (cause) {
		return guardFailure('cart.update', cause, 'The cart request could not be read.');
	}
};

export const DELETE: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	requireBrandSurface('cart');
	if (!isCommerceEnabled()) return disabled('cart.empty');
	try {
		requireSameOrigin(request);
		await requireCommerceMutationCapacity(getClientAddress());
		return commerceResponse(
			await commerceService.empty(
				requireCommerceSessionId(cookies),
				requireIdempotencyKey(request),
			),
		);
	} catch (cause) {
		return guardFailure('cart.empty', cause, 'The cart request could not be read.');
	}
};

function commerceResponse(result: Awaited<ReturnType<typeof commerceService.read>>) {
	return result.ok
		? json(result.data, { status: result.status, headers: commerceHeaders() })
		: json(
				{
					error: result.error,
					evidence: result.evidence,
					services: result.services,
					...(result.replayed ? { replayed: true } : {}),
				},
				{ status: result.status, headers: commerceHeaders() },
			);
}

function disabled(operation: CommerceOperation) {
	const correlationId = crypto.randomUUID();
	return json(
		{
			error: {
				code: 'commerce_disabled',
				message: 'Bealls sandbox commerce is not enabled.',
				retryable: false,
				correlationId,
			},
			evidence: operationEvidence(operation, correlationId, {
				attempted: false,
				provider: 'none',
				changed: 'none',
			}),
			services: getCommerceServiceBoundary(),
		},
		{ status: 503, headers: commerceHeaders() },
	);
}

function invalid(operation: CommerceOperation, message: string) {
	const correlationId = crypto.randomUUID();
	return json(
		{
			error: {
				code: 'invalid_request',
				message,
				retryable: false,
				correlationId,
			},
			evidence: operationEvidence(operation, correlationId, {
				attempted: false,
				provider: 'none',
				changed: 'none',
			}),
			services: getCommerceServiceBoundary(),
		},
		{ status: 400, headers: commerceHeaders() },
	);
}

function guardFailure(operation: CommerceOperation, cause: unknown, fallbackMessage: string) {
	if (cause instanceof CommerceRateLimitError) {
		return localFailure(operation, 'rate_limited', 'Too many cart changes. Wait a minute and try again.', 429, true);
	}
	if (cause instanceof CommerceSessionUnavailableError) {
		return localFailure(operation, 'session_unavailable', 'The cart session is temporarily unavailable.', 503, true);
	}
	return invalid(operation, cause instanceof TypeError ? cause.message : fallbackMessage);
}

function localFailure(
	operation: CommerceOperation,
	code: 'rate_limited' | 'session_unavailable',
	message: string,
	status: number,
	retryable: boolean,
) {
	const correlationId = crypto.randomUUID();
	return json(
		{
			error: { code, message, retryable, correlationId },
			evidence: operationEvidence(operation, correlationId, {
				attempted: false,
				provider: 'none',
				changed: 'none',
			}),
			services: getCommerceServiceBoundary(),
		},
		{ status, headers: commerceHeaders() },
	);
}

function commerceHeaders() {
	return { 'Cache-Control': 'private, no-store' };
}

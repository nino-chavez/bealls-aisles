import {
	compileBrandCompositionPolicy,
	type BeallsFamilyBrandId,
	type TrustedShopperRouteContext,
} from '$lib/brand/bealls-family-runtime-contract';
import type { DecisionMode, EffectiveCompositionPolicy } from '$lib/foundation/composition-policy';
import { resolveZone, type EngineProvenance, type TrustedMerchantZoneRecord, type ZoneResolution } from '$lib/foundation/resolve-zone';
import { parseZoneInstance } from '$lib/foundation/zones';

export type RouteZoneTerminal =
	| 'hidden'
	| 'materialized-fallback'
	| 'materialized-admin'
	| 'materialized-engine';

export interface RouteZoneDecision {
	zoneId: string;
	terminal: RouteZoneTerminal;
	resolution: ZoneResolution;
	policy: EffectiveCompositionPolicy;
}

export interface RouteZoneExecution {
	organizationId: string;
	brandId: BeallsFamilyBrandId;
	routeId: TrustedShopperRouteContext['routeId'];
	routePath: string;
	surface: TrustedShopperRouteContext['surface'];
	policyVersion: string;
	expectedZoneIds: readonly string[];
	decisions: readonly RouteZoneDecision[];
}

export async function executeRouteZones(input: {
	context: TrustedShopperRouteContext;
	engineOutput?: { zones?: Record<string, unknown> };
	engineDecisionMode?: DecisionMode;
	engineProvenance?: EngineProvenance;
	/** Server-owned injection seam for deterministic tests or already-fetched records. */
	merchantRecords?: ReadonlyMap<string, TrustedMerchantZoneRecord | null>;
}): Promise<RouteZoneExecution> {
	const routePolicy = compileBrandCompositionPolicy(input.context.brandId, input.context.surface);
	const decisions = await Promise.all(input.context.zoneInstanceIds.map(async (zoneId): Promise<RouteZoneDecision> => {
		const parsed = parseZoneInstance(zoneId);
		if (!parsed) throw new Error(`route zone runtime: unknown expanded zone "${zoneId}"`);
		const policy = compileBrandCompositionPolicy(input.context.brandId, input.context.surface, parsed.family);
		const resolutionInput = {
			zoneId,
			brandId: input.context.brandId,
			routePath: input.context.routePath,
			policy,
			engineOutput: input.engineOutput,
			engineDecisionMode: input.engineDecisionMode,
			engineProvenance: input.engineProvenance,
			...(input.merchantRecords ? { adminRecord: input.merchantRecords.get(zoneId) ?? null } : {}),
		};
		// Keep the deterministic no-I/O path free of environment/database module
		// loading. Production requests use the trusted store by default.
		const resolution = input.merchantRecords
			? resolveZone(resolutionInput)
			: await (await import('./resolve-zone-async')).resolveZoneAsync(resolutionInput);
		return {
			zoneId,
			terminal: resolution.terminal === 'hidden'
				? 'hidden'
				: resolution.source === 'engine'
					? 'materialized-engine'
					: resolution.source === 'admin'
						? 'materialized-admin'
						: 'materialized-fallback',
			resolution,
			policy,
		};
	}));

	const execution: RouteZoneExecution = {
		organizationId: input.context.organizationId,
		brandId: input.context.brandId,
		routeId: input.context.routeId,
		routePath: input.context.routePath,
		surface: input.context.surface,
		policyVersion: routePolicy.policyVersion,
		expectedZoneIds: [...input.context.zoneInstanceIds],
		decisions,
	};
	assertCompleteRouteZoneExecution(execution);
	return execution;
}

export function assertCompleteRouteZoneExecution(execution: RouteZoneExecution): void {
	const expected = [...execution.expectedZoneIds].sort();
	const actual = execution.decisions.map((decision) => decision.zoneId).sort();
	if (expected.length !== actual.length || expected.some((zoneId, index) => zoneId !== actual[index])) {
		throw new Error(`route zone runtime: incomplete execution for ${execution.brandId}${execution.routePath}`);
	}
	for (const decision of execution.decisions) {
		if (decision.resolution.zoneId !== decision.zoneId || decision.policy.provenance.brandId !== execution.brandId) {
			throw new Error(`route zone runtime: mismatched decision envelope for ${decision.zoneId}`);
		}
		if (decision.terminal === 'hidden' && decision.resolution.content !== null) {
			throw new Error(`route zone runtime: Hidden terminal has content for ${decision.zoneId}`);
		}
		if (decision.terminal !== 'hidden' && decision.resolution.content === null) {
			throw new Error(`route zone runtime: materialized terminal lacks content for ${decision.zoneId}`);
		}
	}
}

export function routeZoneDecision(execution: RouteZoneExecution, zoneId: string): RouteZoneDecision {
	const decision = execution.decisions.find((candidate) => candidate.zoneId === zoneId);
	if (!decision) throw new Error(`route zone runtime: ${zoneId} is not in ${execution.routeId}`);
	return decision;
}

/** A trusted empty route narrows every insertion point to an explicit Hidden terminal. */
export function applyTrustedEmptyRouteState(execution: RouteZoneExecution): RouteZoneExecution {
	const narrowed: RouteZoneExecution = {
		...execution,
		decisions: execution.decisions.map((decision) => ({
			...decision,
			terminal: 'hidden',
			resolution: {
				zoneId: decision.resolution.zoneId,
				family: decision.resolution.family,
				...(decision.resolution.index === undefined ? {} : { index: decision.resolution.index }),
				source: 'fallback',
				terminal: 'hidden',
				content: null,
				policyProvenance: decision.resolution.policyProvenance,
				hiddenReason: 'route-empty',
			},
		})),
	};
	assertCompleteRouteZoneExecution(narrowed);
	return narrowed;
}

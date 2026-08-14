import {
	compileBrandCompositionPolicy,
	type BeallsFamilyBrandId,
	type TrustedShopperRouteContext,
} from '$lib/brand/bealls-family-runtime-contract';
import type { DecisionMode, EffectiveCompositionPolicy } from '$lib/foundation/composition-policy';
import {
	resolveZone,
	type EngineProvenance,
	type TrustedMerchantZoneRecord,
	type ZonePublicationContext,
	type ZoneResolution,
} from '$lib/foundation/resolve-zone';
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
	evidence: ZoneExecutionEvidence;
}

export interface ZoneExecutionEvidence {
	zoneId: string;
	outcome: 'changed' | 'kept' | 'failed' | 'fallback';
	before: unknown | null;
	after: unknown | null;
	failureReason?: string;
}

export interface RouteAiEvidence {
	status: 'applied' | 'disabled' | 'unconfigured' | 'failed' | 'empty';
	provider: 'anthropic' | 'gateway' | 'none';
	modelId: string | null;
	latencyMs: number;
	callCount: number;
	maxOutputTokens: number;
	failureReason?: string;
	reasonCode?: string;
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
	ai?: RouteAiEvidence;
}

export async function executeRouteZones(input: {
	context: TrustedShopperRouteContext;
	engineOutput?: { zones?: Record<string, unknown> };
	engineDecisionMode?: DecisionMode;
	engineProvenance?: EngineProvenance;
	publicationContext?: ZonePublicationContext;
	/** Server-owned injection seam for deterministic tests or already-fetched records. */
	merchantRecords?: ReadonlyMap<string, TrustedMerchantZoneRecord | null>;
	/** Server-owned route-batch loader seam; invoked at most once per execution. */
	merchantRecordLoader?: (
		context: TrustedShopperRouteContext,
		policyVersion: string,
	) => Promise<ReadonlyMap<string, TrustedMerchantZoneRecord | null>>;
	ai?: RouteAiEvidence;
	safeFallbackOutput?: Record<string, unknown>;
}): Promise<RouteZoneExecution> {
	const routePolicy = compileBrandCompositionPolicy(input.context.brandId, input.context.surface);
	let merchantRecords = input.merchantRecords;
	if (!merchantRecords) {
		const loader = input.merchantRecordLoader
			?? (await import('./resolve-zone-async')).loadRouteZoneRecords;
		merchantRecords = await loader(input.context, routePolicy.policyVersion);
	}
	const decisions = input.context.zoneInstanceIds.map((zoneId): RouteZoneDecision => {
		const parsed = parseZoneInstance(zoneId);
		if (!parsed) throw new Error(`route zone runtime: unknown expanded zone "${zoneId}"`);
		const policy = compileBrandCompositionPolicy(input.context.brandId, input.context.surface, parsed.family);
		const resolution = resolveZone({
			zoneId,
			brandId: input.context.brandId,
			routePath: input.context.routePath,
			policy,
			engineOutput: input.engineOutput,
			engineDecisionMode: input.engineDecisionMode,
			engineProvenance: input.engineProvenance,
			publicationContext: input.publicationContext,
			fallbackOutput: input.safeFallbackOutput,
			adminRecord: merchantRecords.get(zoneId) ?? null,
		});
		const baseline = resolveZone({
			zoneId,
			brandId: input.context.brandId,
			routePath: input.context.routePath,
			policy,
			publicationContext: input.publicationContext,
			fallbackOutput: input.safeFallbackOutput,
			adminRecord: merchantRecords.get(zoneId) ?? null,
		});
		const evidence = zoneEvidence({
			zoneId,
			resolution,
			baseline,
			policy,
			ai: input.ai,
		});
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
			evidence,
		};
	});

	const execution: RouteZoneExecution = {
		organizationId: input.context.organizationId,
		brandId: input.context.brandId,
		routeId: input.context.routeId,
		routePath: input.context.routePath,
		surface: input.context.surface,
		policyVersion: routePolicy.policyVersion,
		expectedZoneIds: [...input.context.zoneInstanceIds],
		decisions,
		...(input.ai ? { ai: input.ai } : {}),
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
		if (decision.evidence.zoneId !== decision.zoneId || decision.evidence.after !== decision.resolution.content) {
			throw new Error(`route zone runtime: mismatched evidence for ${decision.zoneId}`);
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

function zoneEvidence(input: {
	zoneId: string;
	resolution: ZoneResolution;
	baseline: ZoneResolution;
	policy: EffectiveCompositionPolicy;
	ai?: RouteAiEvidence;
}): ZoneExecutionEvidence {
	const { resolution, baseline } = input;
	if (resolution.source === 'engine') {
		return {
			zoneId: input.zoneId,
			outcome: stableJson(resolution.content) === stableJson(baseline.content) ? 'kept' : 'changed',
			before: baseline.content,
			after: resolution.content,
		};
	}
	if (resolution.source === 'admin') {
		return {
			zoneId: input.zoneId,
			outcome: 'kept',
			before: baseline.content,
			after: resolution.content,
		};
	}
	if (input.ai?.status === 'failed' && input.policy.decisionMode === 'model') {
		return {
			zoneId: input.zoneId,
			outcome: 'failed',
			before: baseline.content,
			after: resolution.content,
			failureReason: input.ai.failureReason,
		};
	}
	return {
		zoneId: input.zoneId,
		outcome: resolution.source === 'fallback' ? 'fallback' : 'kept',
		before: baseline.content,
		after: resolution.content,
	};
}

function stableJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
	if (value && typeof value === 'object') {
		return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`).join(',')}}`;
	}
	return JSON.stringify(value);
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
			evidence: {
				zoneId: decision.zoneId,
				outcome: 'fallback',
				before: decision.evidence.before,
				after: null,
			},
		})),
	};
	assertCompleteRouteZoneExecution(narrowed);
	return narrowed;
}

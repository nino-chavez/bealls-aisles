import { createHash } from 'node:crypto';
import type { EffectiveCompositionPolicy } from '$lib/foundation/composition-policy';
import {
	normalizeZonePublicationContext,
	validateZonePublicationContent,
	type ZonePublicationContext,
	type ZoneResolution,
} from '$lib/foundation/resolve-zone';
import { parseZoneInstance, ZONES } from '$lib/foundation/zones';
import {
	ZoneDecisionContextSchema,
	ZoneDecisionEnvelopeSchema,
	hasExactZoneDecisionContext,
	hasConsistentZoneDecisionEnvelope,
	type ZoneDecisionContext,
	type ZoneDecisionEnvelope,
} from '$lib/foundation/zone-decision-envelope-schema';

export {
	ZoneDecisionContextSchema,
	ZoneDecisionEnvelopeSchema,
	type ZoneDecisionContext,
	type ZoneDecisionEnvelope,
} from '$lib/foundation/zone-decision-envelope-schema';

export function createZoneDecisionContext(input: {
	policy: EffectiveCompositionPolicy;
	routeId: string;
	routePath: string;
	zoneId: string;
	viewportClass: ZoneDecisionContext['viewportClass'];
	catalogVersion: string;
	contentVersion: string;
	publicationContext: ZonePublicationContext;
	syntheticProvenance: ZoneDecisionContext['syntheticProvenance'];
	approvedInputHash: string;
}): ZoneDecisionContext {
	const parsed = parseZoneInstance(input.zoneId);
	if (!parsed || input.policy.provenance.zoneId !== parsed.family) throw new Error('decision envelope: zone policy mismatch');
	return ZoneDecisionContextSchema.parse({
		organizationId: input.policy.provenance.organizationId,
		organizationPolicyVersion: input.policy.provenance.organizationPolicyVersion,
		brandId: input.policy.provenance.brandId,
		brandPolicyVersion: input.policy.provenance.brandPolicyVersion,
		routeId: input.routeId,
		routePath: input.routePath,
		surface: ZONES[parsed.family].surface,
		zoneId: input.zoneId,
		effectivePolicyVersion: input.policy.policyVersion,
		autonomyPreset: input.policy.provenance.preset,
		decisionMode: input.policy.decisionMode,
		publicationMode: input.policy.publicationMode,
		trustedRule: input.policy.trustedRule,
		capabilities: [...input.policy.capabilities],
		reference: { state: input.policy.provenance.referenceState, id: null, version: null },
		viewportClass: input.viewportClass,
		catalogVersion: input.catalogVersion,
		contentVersion: input.contentVersion,
		publicationClosure: normalizeZonePublicationContext(input.publicationContext),
		syntheticProvenance: input.syntheticProvenance,
		approvedInputHash: input.approvedInputHash,
	});
}

export function createZoneDecisionEnvelope(
	context: ZoneDecisionContext,
	resolution: ZoneResolution,
): ZoneDecisionEnvelope {
	if (context.zoneId !== resolution.zoneId) throw new Error('decision envelope: expanded zone mismatch');
	const content = resolution.terminal === 'hidden'
		? null
		: validateZonePublicationContent({
				brandId: context.brandId,
				zoneId: context.zoneId,
				raw: resolution.content,
				publicationContext: context.publicationClosure,
			});
	const engine = resolution.engineProvenance
		? resolution.engineProvenance.kind === 'model'
			? { kind: 'model' as const, id: resolution.engineProvenance.modelId, version: resolution.engineProvenance.approvedInputHash }
			: { kind: 'trusted-rule' as const, id: resolution.engineProvenance.id, version: resolution.engineProvenance.version }
		: null;
	const envelope = ZoneDecisionEnvelopeSchema.parse({
		schemaVersion: 'zone-decision-envelope-v1',
		context,
		provenance: {
			source: resolution.source,
			engine,
			merchantAuthority: resolution.merchantAuthority ?? null,
		},
		terminal: resolution.terminal,
		content,
	});
	if (!hasConsistentZoneDecisionEnvelope(envelope)) {
		throw new Error('decision envelope: inconsistent source, provenance, or terminal');
	}
	return envelope;
}

/** Parse, bind to the current full context, and revalidate zone content. */
export function revalidateCachedZoneDecision(
	raw: unknown,
	expected: ZoneDecisionContext,
): ZoneDecisionEnvelope | null {
	const parsed = ZoneDecisionEnvelopeSchema.safeParse(raw);
	if (!parsed.success) return null;
	if (!hasConsistentZoneDecisionEnvelope(parsed.data)) return null;
	if (!hasExactZoneDecisionContext(parsed.data.context, expected)) return null;
	if (parsed.data.terminal === 'hidden') return parsed.data.content === null ? parsed.data : null;
	if (parsed.data.content === null) return null;
	try {
		const content = validateZonePublicationContent({
			brandId: expected.brandId,
			zoneId: expected.zoneId,
			raw: parsed.data.content,
			publicationContext: expected.publicationClosure,
		});
		return { ...parsed.data, content };
	} catch {
		return null;
	}
}

export function zoneDecisionCacheKey(context: ZoneDecisionContext): string {
	const digest = sha256(stableJson(context));
	return `aisles:zone-decision:v1:${context.organizationId}:${context.brandId}:${context.zoneId}:${digest}`;
}

export function approvedInputHash(value: unknown): string {
	return sha256(stableJson(value));
}

export function catalogVersion(value: unknown): string {
	return `sha256:${sha256(stableJson(value))}`;
}

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function stableJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
	if (value && typeof value === 'object') {
		return `{${Object.entries(value as Record<string, unknown>)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`).join(',')}}`;
	}
	return JSON.stringify(value);
}

import { z } from 'zod';
import { AUTONOMY_CAPABILITIES, AUTONOMY_PRESETS, DECISION_MODES, PUBLICATION_MODES, TRUSTED_RULES } from './composition-policy';

const ReferenceSchema = z.strictObject({
	state: z.literal('uncontracted'),
	id: z.null(),
	version: z.null(),
});

/** Client-safe wire schema. Server-only hashing and cache logic live elsewhere. */
export const ZoneDecisionContextSchema = z.strictObject({
	organizationId: z.string().trim().min(1).max(128),
	organizationPolicyVersion: z.string().trim().min(1).max(256),
	brandId: z.enum(['bealls', 'beallsflorida', 'homecentric']),
	brandPolicyVersion: z.string().trim().min(1).max(256),
	routeId: z.string().trim().min(1).max(128),
	routePath: z.string().startsWith('/').max(512),
	surface: z.enum(['home', 'plp', 'pdp', 'cart', 'checkout', 'search', 'account', 'locator', 'error-404', 'error-empty']),
	zoneId: z.string().trim().min(1).max(128),
	effectivePolicyVersion: z.string().trim().min(1).max(1024),
	autonomyPreset: z.enum(AUTONOMY_PRESETS),
	decisionMode: z.enum(DECISION_MODES),
	publicationMode: z.enum(PUBLICATION_MODES),
	trustedRule: z.strictObject({
		id: z.literal(TRUSTED_RULES['pdp-tag-overlap-v1'].id),
		version: z.literal(TRUSTED_RULES['pdp-tag-overlap-v1'].version),
	}).nullable(),
	capabilities: z.array(z.enum(AUTONOMY_CAPABILITIES)).max(AUTONOMY_CAPABILITIES.length),
	reference: ReferenceSchema,
	viewportClass: z.enum(['mobile', 'tablet', 'desktop']),
	catalogVersion: z.string().trim().min(1).max(128),
	contentVersion: z.string().trim().min(1).max(128),
	publicationClosure: z.strictObject({
		candidateProductIds: z.array(z.string().trim().min(1).max(128)).max(128),
		candidateAssetUrls: z.array(z.string().trim().min(1).max(8192)).max(128),
	}),
	syntheticProvenance: z.strictObject({
		kind: z.enum(['none', 'parity-fixture']),
		version: z.string().trim().min(1).max(128),
	}),
	approvedInputHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type ZoneDecisionContext = z.infer<typeof ZoneDecisionContextSchema>;

export const ZoneDecisionEnvelopeSchema = z.strictObject({
	schemaVersion: z.literal('zone-decision-envelope-v1'),
	context: ZoneDecisionContextSchema,
	provenance: z.strictObject({
		source: z.enum(['engine', 'admin', 'fallback']),
		engine: z.strictObject({
			kind: z.enum(['trusted-rule', 'model']),
			id: z.string().trim().min(1).max(256),
			version: z.string().trim().min(1).max(128),
		}).nullable(),
		merchantAuthority: z.enum(['authored', 'pin', 'lock']).nullable(),
	}),
	terminal: z.enum(['materialized', 'hidden']),
	content: z.unknown().nullable(),
});
export type ZoneDecisionEnvelope = z.infer<typeof ZoneDecisionEnvelopeSchema>;

/** One exact-context comparison shared by cache and client publication boundaries. */
export function hasExactZoneDecisionContext(actual: unknown, expected: unknown): boolean {
	const actualParsed = ZoneDecisionContextSchema.safeParse(actual);
	const expectedParsed = ZoneDecisionContextSchema.safeParse(expected);
	return actualParsed.success && expectedParsed.success
		&& stableJson(actualParsed.data) === stableJson(expectedParsed.data);
}

/** One source/provenance/terminal invariant shared by creation, cache, and clients. */
export function hasConsistentZoneDecisionEnvelope(envelope: ZoneDecisionEnvelope): boolean {
	if ((envelope.terminal === 'hidden') !== (envelope.content === null)) return false;
	if (envelope.terminal === 'hidden' && envelope.provenance.source !== 'fallback') return false;

	const { source, engine, merchantAuthority } = envelope.provenance;
	if (source === 'admin') return engine === null && merchantAuthority !== null && envelope.terminal === 'materialized';
	if (source === 'fallback') return engine === null && merchantAuthority === null;
	if (engine === null || merchantAuthority !== null || envelope.terminal !== 'materialized'
		|| envelope.context.publicationMode !== 'live' || envelope.context.decisionMode === 'fixed') return false;
	if (engine.kind === 'model') {
		return envelope.context.decisionMode === 'model' && envelope.context.trustedRule === null
			&& engine.version === envelope.context.approvedInputHash;
	}
	return envelope.context.decisionMode === 'rules' && envelope.context.trustedRule !== null
		&& engine.id === envelope.context.trustedRule.id
		&& engine.version === envelope.context.trustedRule.version;
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

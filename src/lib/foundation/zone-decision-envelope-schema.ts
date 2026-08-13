import { z } from 'zod';
import { AUTONOMY_CAPABILITIES, AUTONOMY_PRESETS, DECISION_MODES, PUBLICATION_MODES } from './composition-policy';

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
	capabilities: z.array(z.enum(AUTONOMY_CAPABILITIES)).max(AUTONOMY_CAPABILITIES.length),
	reference: ReferenceSchema,
	viewportClass: z.enum(['mobile', 'tablet', 'desktop']),
	catalogVersion: z.string().trim().min(1).max(128),
	contentVersion: z.string().trim().min(1).max(128),
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

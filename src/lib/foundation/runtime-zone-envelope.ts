import { ZoneDecisionEnvelopeSchema, hasConsistentZoneDecisionEnvelope } from './zone-decision-envelope-schema';
import {
	normalizeZonePublicationContext,
	validateZonePublicationContent,
	type ZonePublicationContext,
} from './resolve-zone';

export type RuntimeZoneSource = 'engine' | 'admin' | 'fallback';
export type MaterializedRuntimeZoneTerminal = 'materialized-engine' | 'materialized-admin' | 'materialized-fallback';

export interface RuntimeZoneEnvelopeView {
	zoneId: string;
	source: RuntimeZoneSource;
	terminal: MaterializedRuntimeZoneTerminal;
	content: { component: string; props: Record<string, unknown> };
}

export interface RuntimeZoneEnvelopeExpectation {
	organizationId: string;
	brandId: string;
	routeId: string;
	routePath: string;
	surface: string;
	zoneId: string;
	component: string;
	publicationContext: ZonePublicationContext;
}

/** Validate the wire envelope and bind it to the exact consuming route and renderer branch. */
export function runtimeZoneViewFromEnvelope(
	raw: unknown,
	expected: RuntimeZoneEnvelopeExpectation,
): RuntimeZoneEnvelopeView | null {
	const parsed = ZoneDecisionEnvelopeSchema.safeParse(raw);
	if (!parsed.success) return null;
	const envelope = parsed.data;
	if (envelope.context.organizationId !== expected.organizationId
		|| envelope.context.brandId !== expected.brandId
		|| envelope.context.routeId !== expected.routeId
		|| envelope.context.routePath !== expected.routePath
		|| envelope.context.surface !== expected.surface
		|| envelope.context.zoneId !== expected.zoneId
		|| envelope.terminal !== 'materialized') return null;
	if (!hasConsistentZoneDecisionEnvelope(envelope)) return null;
	const publicationClosure = normalizeZonePublicationContext(expected.publicationContext);
	if (JSON.stringify(envelope.context.publicationClosure) !== JSON.stringify(publicationClosure)) return null;
	let content: unknown;
	try {
		content = validateZonePublicationContent({
			brandId: expected.brandId,
			zoneId: expected.zoneId,
			raw: envelope.content,
			publicationContext: publicationClosure,
		});
	} catch {
		return null;
	}
	if (!content || Array.isArray(content) || typeof content !== 'object' || !('component' in content)
		|| content.component !== expected.component) return null;
	return {
		zoneId: expected.zoneId,
		source: envelope.provenance.source,
		terminal: terminalForSource(envelope.provenance.source),
		content: content as { component: string; props: Record<string, unknown> },
	};
}

export function runtimeZoneDomAttributes(view: RuntimeZoneEnvelopeView): Record<string, string> {
	return {
		'data-runtime-zone': view.zoneId,
		'data-zone-source': view.source,
		'data-zone-terminal': view.terminal,
	};
}

function terminalForSource(source: RuntimeZoneSource): MaterializedRuntimeZoneTerminal {
	return `materialized-${source}`;
}

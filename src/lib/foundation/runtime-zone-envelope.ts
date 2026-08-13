import {
	ZoneDecisionEnvelopeSchema,
	hasConsistentZoneDecisionEnvelope,
	hasExactZoneDecisionContext,
} from './zone-decision-envelope-schema';
import type { ZoneDecisionContext } from './zone-decision-envelope-schema';
import {
	normalizeZonePublicationContext,
	validateZonePublicationContent,
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
	context: ZoneDecisionContext;
	component: string;
}

/** Validate the wire envelope and bind it to the exact consuming route and renderer branch. */
export function runtimeZoneViewFromEnvelope(
	raw: unknown,
	expected: RuntimeZoneEnvelopeExpectation,
): RuntimeZoneEnvelopeView | null {
	const parsed = ZoneDecisionEnvelopeSchema.safeParse(raw);
	if (!parsed.success) return null;
	const envelope = parsed.data;
	if (!hasExactZoneDecisionContext(envelope.context, expected.context)
		|| envelope.terminal !== 'materialized') return null;
	if (!hasConsistentZoneDecisionEnvelope(envelope)) return null;
	const publicationClosure = normalizeZonePublicationContext(expected.context.publicationClosure);
	if (JSON.stringify(envelope.context.publicationClosure) !== JSON.stringify(publicationClosure)) return null;
	let content: unknown;
	try {
		content = validateZonePublicationContent({
			brandId: expected.context.brandId,
			zoneId: expected.context.zoneId,
			raw: envelope.content,
			publicationContext: publicationClosure,
		});
	} catch {
		return null;
	}
	if (!content || Array.isArray(content) || typeof content !== 'object' || !('component' in content)
		|| content.component !== expected.component) return null;
	return {
		zoneId: expected.context.zoneId,
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

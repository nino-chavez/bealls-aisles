import { ZoneDecisionEnvelopeSchema } from './zone-decision-envelope-schema';
import { validateZoneContent } from './resolve-zone';

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
	if (!hasConsistentProvenance(envelope.provenance)) return null;
	const content = validateZoneContent(expected.zoneId, envelope.content);
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

function hasConsistentProvenance(provenance: {
	source: RuntimeZoneSource;
	engine: unknown | null;
	merchantAuthority: 'authored' | 'pin' | 'lock' | null;
}): boolean {
	if (provenance.source === 'engine') return provenance.engine !== null && provenance.merchantAuthority === null;
	if (provenance.source === 'admin') return provenance.engine === null && provenance.merchantAuthority !== null;
	return provenance.engine === null && provenance.merchantAuthority === null;
}

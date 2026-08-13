import { ZoneSchemas } from './zone-schemas';
import { ZONES, parseZoneInstance, type ZoneId, type ZoneInstanceId, type ZoneMetadata } from './zones';
import { getFallback } from './fallbacks';
import type { AutonomyCapability, DecisionMode, EffectiveCompositionPolicy } from './composition-policy';

export type ZoneSource = 'engine' | 'admin' | 'fallback';
export type ZoneTerminal = 'materialized' | 'hidden';

export interface MerchantZoneBinding {
	organizationId: string;
	brandId: string;
	routePath: string;
	surface: string;
	zoneId: ZoneInstanceId;
	policyVersion: string;
	referenceState: 'uncontracted';
	referenceId: string | null;
	referenceVersion: string | null;
}

export interface TrustedMerchantZoneRecord {
	authority: 'authored' | 'pin' | 'lock';
	binding: MerchantZoneBinding;
	contentVersion: string;
	content: unknown;
}

export type EngineProvenance =
	| { kind: 'trusted-rule'; id: 'pdp-tag-overlap-v1'; version: '1' }
	| { kind: 'model'; approvedInputHash: string; modelId: string };

export interface ZoneResolution {
	zoneId: ZoneInstanceId;
	family: ZoneId;
	index?: number;
	source: ZoneSource;
	terminal: ZoneTerminal;
	content: unknown | null;
	policyProvenance: EffectiveCompositionPolicy['provenance'];
	merchantAuthority?: TrustedMerchantZoneRecord['authority'];
	merchantContentVersion?: string;
	engineProvenance?: EngineProvenance;
	hiddenReason?: 'no-authorized-content' | 'route-empty';
}

export interface ResolveZoneOpts {
	zoneId: ZoneInstanceId;
	brandId: string;
	routePath: string;
	/** A compiled server-trusted policy is mandatory at the publication boundary. */
	policy: EffectiveCompositionPolicy;
	engineOutput?: { zones?: Record<ZoneInstanceId, unknown> };
	engineDecisionMode?: DecisionMode;
	engineProvenance?: EngineProvenance;
	adminRecord?: TrustedMerchantZoneRecord | null;
}

export function resolveZone(opts: ResolveZoneOpts): ZoneResolution {
	const parsed = parseZoneInstance(opts.zoneId);
	if (!parsed) throw new Error(`resolveZone: unknown zone instance "${opts.zoneId}"`);
	const { family, index } = parsed;
	const meta = ZONES[family] as ZoneMetadata;
	assertPolicyBinding(opts, family);

	const lockedAdmin = trustedMerchantContent(opts, family, meta, ['pin', 'lock']);
	if (lockedAdmin) return resolution(opts, family, index, 'admin', lockedAdmin.content, { merchantAuthority: lockedAdmin.authority, merchantContentVersion: lockedAdmin.contentVersion });

	const engineRaw = opts.engineOutput?.zones?.[opts.zoneId];
	if (engineRaw !== undefined && meta.engineComposable && permitsEngineOutput(opts, family, engineRaw)) {
		const validated = validateForZone(family, engineRaw, meta);
		if (validated.ok) {
			return resolution(opts, family, index, 'engine', validated.content, { engineProvenance: opts.engineProvenance });
		}
	}

	const authoredAdmin = trustedMerchantContent(opts, family, meta, ['authored']);
	if (authoredAdmin) return resolution(opts, family, index, 'admin', authoredAdmin.content, { merchantAuthority: authoredAdmin.authority, merchantContentVersion: authoredAdmin.contentVersion });

	const fallbackRaw = getFallback(family, opts.brandId);
	if (fallbackRaw === null || fallbackRaw === undefined) return resolution(opts, family, index, 'fallback', null);
	const fallback = validateForZone(family, fallbackRaw, meta);
	return resolution(opts, family, index, 'fallback', fallback.ok ? fallback.content : null);
}

function resolution(
	opts: ResolveZoneOpts,
	family: ZoneId,
	index: number | undefined,
	source: ZoneSource,
	content: unknown | null,
	extra: Pick<ZoneResolution, 'merchantAuthority' | 'merchantContentVersion' | 'engineProvenance'> = {},
): ZoneResolution {
	return {
		zoneId: opts.zoneId,
		family,
		...(index === undefined ? {} : { index }),
		source,
		terminal: content === null ? 'hidden' : 'materialized',
		...(content === null ? { hiddenReason: 'no-authorized-content' as const } : {}),
		content,
		policyProvenance: opts.policy.provenance,
		...(extra.merchantAuthority ? { merchantAuthority: extra.merchantAuthority } : {}),
		...(extra.merchantContentVersion ? { merchantContentVersion: extra.merchantContentVersion } : {}),
		...(extra.engineProvenance ? { engineProvenance: extra.engineProvenance } : {}),
	};
}

const DECISION_AUTHORITY: Record<DecisionMode, number> = { fixed: 0, rules: 1, model: 2 };

function assertPolicyBinding(opts: ResolveZoneOpts, family: ZoneId): void {
	const p = opts.policy.provenance;
	if (
		p.organizationId.trim() === '' ||
		p.brandId !== opts.brandId ||
		p.zoneId !== family ||
		p.surface !== ZONES[family].surface
	) {
		throw new Error(`resolveZone: policy is not bound to ${opts.brandId}/${family}`);
	}
	if (!opts.routePath.startsWith('/')) throw new Error('resolveZone: trusted routePath is required');
}

function permitsEngineOutput(opts: ResolveZoneOpts, family: ZoneId, content: unknown): boolean {
	if (opts.policy.publicationMode !== 'live' || opts.policy.decisionMode === 'fixed') return false;
	if (!opts.engineDecisionMode || !opts.engineProvenance) return false;
	if (DECISION_AUTHORITY[opts.engineDecisionMode] > DECISION_AUTHORITY[opts.policy.decisionMode]) return false;
	if (opts.engineDecisionMode === 'rules' && opts.engineProvenance.kind !== 'trusted-rule') return false;
	if (opts.engineDecisionMode === 'model' && opts.engineProvenance.kind !== 'model') return false;
	const required = requiredCapabilities(content, opts.engineDecisionMode);
	return required.every((capability) => opts.policy.capabilities.includes(capability));
}

function requiredCapabilities(content: unknown, mode: DecisionMode): AutonomyCapability[] {
	const required = new Set<AutonomyCapability>();
	let hasProductRef = false;
	let hasGeneratedCopy = false;
	walk(content, (key, value) => {
		if (key === 'productId' && typeof value === 'string') hasProductRef = true;
		if (
			mode === 'model' && typeof value === 'string' &&
			!['component', 'productId', 'role', 'image', 'href', 'ctaHref', 'icon', 'endsAt'].includes(key)
		) hasGeneratedCopy = true;
	});
	if (hasProductRef) {
		required.add('rank_products');
		required.add('select_products');
	}
	if (mode === 'model') {
		required.add('select_component_variant');
		if (hasGeneratedCopy) {
			required.add('select_copy_variant');
			required.add('generate_bounded_copy');
		}
	}
	return [...required];
}

function trustedMerchantContent(
	opts: ResolveZoneOpts,
	family: ZoneId,
	meta: ZoneMetadata,
	authorities: readonly TrustedMerchantZoneRecord['authority'][],
): TrustedMerchantZoneRecord | null {
	const record = opts.adminRecord;
	if (!record || !authorities.includes(record.authority) || !meta.adminAuthorable) return null;
	const b = record.binding;
	const p = opts.policy;
	if (
		b.organizationId !== p.provenance.organizationId ||
		b.brandId !== opts.brandId ||
		b.routePath !== opts.routePath ||
		b.surface !== meta.surface ||
		b.zoneId !== opts.zoneId ||
		b.policyVersion !== p.policyVersion ||
		b.referenceState !== p.provenance.referenceState ||
		b.referenceId !== null || b.referenceVersion !== null ||
		record.contentVersion.trim() === ''
	) return null;
	const validated = validateForZone(family, record.content, meta);
	return validated.ok ? { ...record, content: validated.content } : null;
}

export function validateZoneContent(zoneId: ZoneInstanceId, raw: unknown): unknown | null {
	const parsed = parseZoneInstance(zoneId);
	if (!parsed) return null;
	const validated = validateForZone(parsed.family, raw, ZONES[parsed.family] as ZoneMetadata);
	return validated.ok ? validated.content : null;
}

function validateForZone(
	family: ZoneId,
	raw: unknown,
	meta: ZoneMetadata,
): { ok: true; content: unknown } | { ok: false } {
	const schema = ZoneSchemas[family];
	if (meta.multiplicity === 'array') {
		if (!Array.isArray(raw) || (meta.maxItems !== undefined && raw.length > meta.maxItems)) return { ok: false };
		const validated: unknown[] = [];
		for (const item of raw) {
			const result = schema.safeParse(item);
			if (!result.success) return { ok: false };
			validated.push(result.data);
		}
		return { ok: true, content: validated };
	}
	const result = schema.safeParse(raw);
	return result.success ? { ok: true, content: result.data } : { ok: false };
}

function walk(value: unknown, visit: (key: string, child: unknown) => void): void {
	if (Array.isArray(value)) {
		for (const item of value) walk(item, visit);
		return;
	}
	if (!value || typeof value !== 'object') return;
	for (const [key, child] of Object.entries(value)) {
		visit(key, child);
		walk(child, visit);
	}
}

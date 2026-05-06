import { gateway } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { jsonSchema, asSchema, type Schema } from '@ai-sdk/provider-utils';
import type { z } from 'zod';
import { env } from '$env/dynamic/private';

export const useCfAig = !!(env.CF_AIG_ACCOUNT_ID && env.CF_AIG_GATEWAY_ID);
export const useGateway = !useCfAig && (!!env.AI_GATEWAY_API_KEY || !!env.VERCEL_OIDC_TOKEN);

const directAnthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

const cfAig = useCfAig
	? createAnthropic({
			apiKey: env.ANTHROPIC_API_KEY,
			baseURL: `https://gateway.ai.cloudflare.com/v1/${env.CF_AIG_ACCOUNT_ID}/${env.CF_AIG_GATEWAY_ID}/anthropic`,
		})
	: null;

const directOpenRouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
const cfAigOpenRouter = useCfAig
	? createOpenRouter({
			apiKey: env.OPENROUTER_API_KEY,
			baseURL: `https://gateway.ai.cloudflare.com/v1/${env.CF_AIG_ACCOUNT_ID}/${env.CF_AIG_GATEWAY_ID}/openrouter`,
		})
	: null;

export function layoutModel() {
	if (useCfAig && cfAig) return cfAig('claude-haiku-4-5-20251001');
	if (useGateway) return gateway('anthropic/claude-haiku-4.5');
	return directAnthropic('claude-haiku-4-5-20251001');
}

export function enrichmentModel() {
	if (useCfAig && cfAig) return cfAig('claude-sonnet-4-20250514');
	if (useGateway) return gateway('anthropic/claude-sonnet-4');
	return directAnthropic('claude-sonnet-4-20250514');
}

export function embeddingModel() {
	if (useCfAig && cfAigOpenRouter) return cfAigOpenRouter.textEmbeddingModel('openai/text-embedding-3-small');
	return directOpenRouter.textEmbeddingModel('openai/text-embedding-3-small');
}

// ─── Anthropic input_schema sanitizer ──────────────────────────────
//
// Anthropic's `messages` API tool validator strictly rejects JSON Schema
// keywords it doesn't support, and rejects `oneOf` siblings without a
// `type`. Our Zod-derived layout schemas use `discriminatedUnion` (→
// `oneOf`) and `int().min().max()` (→ `minimum`/`maximum`/`minItems`/
// `maxItems`), so the raw schema fails server-side validation with the
// error `tools.0.custom.input_schema.type: Field required` at a nested
// node.
//
// AI SDK v3.0.73 added an equivalent sanitizer but only for the
// `output_config.format.schema` path. The `jsonTool` / `tools[].input_schema`
// path we use (forced by `structuredOutputMode: 'jsonTool'` to avoid an
// earlier `oneOf` rejection at the format path) is NOT sanitized in 3.0.x
// or 4.0.0 canary. Until that lands upstream, sanitize locally.
//
// Drop-in alternative when fixed upstream: remove this block and the
// `anthropicSafeSchema` call sites; pass the Zod schema directly. See
// vercel/ai PR #14790 for the upstream sanitizer to mirror.

const ANTHROPIC_UNSUPPORTED_KEYS = new Set([
	'minimum',
	'maximum',
	'exclusiveMinimum',
	'exclusiveMaximum',
	'multipleOf',
	'minLength',
	'maxLength',
	'pattern',
	'minItems',
	'maxItems',
	'uniqueItems',
	'minProperties',
	'maxProperties',
	'not',
]);

function sanitizeForAnthropic(node: unknown): unknown {
	if (Array.isArray(node)) return node.map(sanitizeForAnthropic);
	if (!node || typeof node !== 'object') return node;
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
		if (ANTHROPIC_UNSUPPORTED_KEYS.has(k)) continue;
		if (k === 'oneOf' && Array.isArray(v)) {
			out.anyOf = v.map(sanitizeForAnthropic);
		} else {
			out[k] = sanitizeForAnthropic(v);
		}
	}
	return out;
}

/**
 * Wrap a Zod schema as an AI-SDK `Schema` whose JSON has been sanitized
 * for the Anthropic input_schema validator. The original Zod schema is
 * preserved as the runtime validator; we only relax what we send on
 * the wire. Safe across all model paths (CF AI Gateway, Vercel AI
 * Gateway, direct Anthropic) since all eventually hit Anthropic.
 */
export async function anthropicSafeSchema<T = unknown>(
	zodSchema: z.ZodTypeAny,
): Promise<Schema<T>> {
	const rawJson = await Promise.resolve(asSchema(zodSchema).jsonSchema);
	const sanitized = sanitizeForAnthropic(rawJson) as Parameters<typeof jsonSchema>[0];
	return jsonSchema<T>(sanitized, {
		validate: async (value) => {
			const r = await zodSchema.safeParseAsync(value);
			return r.success
				? { success: true, value: r.data as T }
				: { success: false, error: r.error };
		},
	});
}

export function gatewayProviderOptions(persona: string, categorySlug: string, feature = 'layout') {
	if (useCfAig) {
		// Anthropic's beta `output_config.format` doesn't accept `oneOf`,
		// which our discriminated-union layout schemas compile to. Force
		// the AI SDK's `jsonTool` mode — uses Anthropic's tool-use API,
		// which supports our schema. Vercel AI Gateway transparently
		// rewrites; going direct via baseURL needs the explicit hint.
		return {
			headers: {
				'cf-aig-metadata': JSON.stringify({
					feature,
					persona,
					category: categorySlug,
				}),
			},
			providerOptions: {
				anthropic: { structuredOutputMode: 'jsonTool' as const },
			},
		};
	}
	if (useGateway) {
		return {
			providerOptions: {
				gateway: {
					models: ['anthropic/claude-sonnet-4.6'],
					tags: [`feature:${feature}`, `persona:${persona}`, `category:${categorySlug}`],
				},
			},
		};
	}
	return undefined;
}

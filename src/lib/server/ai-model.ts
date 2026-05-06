import { gateway } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
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

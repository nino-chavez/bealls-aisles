import { gateway } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
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

export function layoutModel() {
	if (useCfAig && cfAig) return cfAig('claude-haiku-4-5-20251001');
	if (useGateway) return gateway('anthropic/claude-haiku-4.5');
	return directAnthropic('claude-haiku-4-5-20251001');
}

export function gatewayProviderOptions(persona: string, categorySlug: string) {
	if (useCfAig) {
		return {
			headers: {
				'cf-aig-metadata': JSON.stringify({
					feature: 'layout',
					persona,
					category: categorySlug,
				}),
			},
		};
	}
	if (useGateway) {
		return {
			providerOptions: {
				gateway: {
					models: ['anthropic/claude-sonnet-4.6'],
					tags: [`feature:layout`, `persona:${persona}`, `category:${categorySlug}`],
				},
			},
		};
	}
	return undefined;
}

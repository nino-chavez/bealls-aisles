/**
 * Model selector — uses Vercel AI Gateway when available, falls back to
 * direct Anthropic provider for local dev when AI_GATEWAY_API_KEY is unset.
 *
 * The gateway path supports model fallback chains and cost tagging via
 * providerOptions.gateway. The direct path is simpler and only requires
 * ANTHROPIC_API_KEY.
 */
import { gateway } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { env } from '$env/dynamic/private';

const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

// Vercel AI Gateway accepts either AI_GATEWAY_API_KEY (long-lived) or
// VERCEL_OIDC_TOKEN (auto-injected on Vercel; 12-hour TTL when pulled
// locally via `vercel env pull --environment=development`).
export const useGateway = !!env.AI_GATEWAY_API_KEY || !!env.VERCEL_OIDC_TOKEN;

/**
 * Returns the configured model for layout generation.
 * - Gateway path: 'anthropic/claude-haiku-4.5' (with sonnet fallback via providerOptions)
 * - Direct path:  'claude-haiku-4-5-20251001'
 */
export function layoutModel() {
	return useGateway
		? gateway('anthropic/claude-haiku-4.5')
		: anthropic('claude-haiku-4-5-20251001');
}

export function gatewayProviderOptions(persona: string, categorySlug: string) {
	if (!useGateway) return undefined;
	return {
		gateway: {
			models: ['anthropic/claude-sonnet-4.6'],
			tags: [
				'feature:layout',
				`persona:${persona}`,
				`category:${categorySlug}`,
			],
		},
	};
}

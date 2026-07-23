import { z } from 'zod';
import { StorefrontBlocks, ContentBlocks } from '../blocks';

/**
 * HomeLayoutSchema — wide composition latitude.
 *
 * The home surface is the brand's front door. AI composes an ordered
 * array of 6–10 sections drawn from the full block vocabulary
 * (storefront mode) or the content subset (content mode). The
 * composition is constrained by surface latitude rules in the prompt
 * (composition-taxonomy.md §5.1) but the schema allows the full set.
 *
 * Per ADR-006: home and PLP are intentionally identical at first;
 * they will diverge in subsequent phases as PLP adds named header /
 * body / insertion zones while home stays wide-latitude.
 */

const layoutBase = {
	persona: z.enum(['gatherer', 'hunter', 'researcher', 'gifter']).describe('Detected persona'),
	reasoning: z.string().describe('Why this layout was chosen (1-2 sentences)'),
	productOrder: z.array(z.string()).describe('Product IDs in display order (empty array for content-mode brands)'),
};

export const HomeStorefrontLayoutSchema = z.object({
	...layoutBase,
	surface: z.literal('home').optional().describe('Surface discriminator (optional for backwards compat)'),
	sections: z
		.array(z.discriminatedUnion('component', [...StorefrontBlocks]))
		.min(1)
		.describe('Ordered UI sections (6–10 ideal, max 8 enforced via prompt)'),
});

export const HomeContentLayoutSchema = z.object({
	...layoutBase,
	surface: z.literal('home').optional(),
	sections: z
		.array(z.discriminatedUnion('component', [...ContentBlocks]))
		.min(1)
		.describe('Ordered UI sections (content-mode subset)'),
});

export type HomeStorefrontLayout = z.infer<typeof HomeStorefrontLayoutSchema>;
export type HomeContentLayout = z.infer<typeof HomeContentLayoutSchema>;

export function getHomeLayoutSchema(mode: 'storefront' | 'content') {
	return mode === 'content' ? HomeContentLayoutSchema : HomeStorefrontLayoutSchema;
}

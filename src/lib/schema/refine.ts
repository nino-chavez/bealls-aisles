import { z } from 'zod';
import { LayoutSchema } from './layout';

/**
 * Refine Response Schema — layout + conversational response for negotiation.
 *
 * Per ADR-008 Phase A: refinement chat extracts a `tagIntents` vector
 * alongside the layout. The vector is constrained to tags that exist in the
 * brand's enrichment vocabulary (post-validated server-side after the LLM
 * call). Empty array means the NL was too generic to extract intents — the
 * engine falls back to persona-only ranking (Q-012).
 */
// Conversational fields defensively defaulted so a Haiku miss on any one
// field doesn't fail the whole refinement turn. The endpoint already
// substitutes friendly fallbacks when these are empty.
export const RefineResponseSchema = z.object({
	layout: LayoutSchema,
	chatResponse: z.string().default('').describe('1-2 sentence response to the shopper. Acknowledge changes. Explain conflicts.'),
	constraintApplied: z.string().default('').describe('Short filter label, e.g. "under $500", "wireless only"'),
	constraintConflict: z.boolean().default(false).describe('True if constraints conflict or eliminate all products'),
	tagIntents: z.array(z.string()).default([]).describe('Semantic tags extracted from the NL message. MUST be a subset of the BRAND TAG VOCABULARY provided in the prompt — never invent tags. Empty array if the message is too generic to extract concrete intents.'),
});

export type RefineResponse = z.infer<typeof RefineResponseSchema>;

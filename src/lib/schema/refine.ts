import { z } from 'zod';
import { LayoutSchema } from './layout';

/**
 * Refine Response Schema — extends Layout with conversational response.
 *
 * The AI generates both a new layout AND a natural language response
 * to the shopper, enabling negotiation when constraints conflict.
 */
export const RefineResponseSchema = z.object({
	layout: LayoutSchema,
	chatResponse: z.string().describe(
		'A brief, natural response to the shopper (1-2 sentences). Acknowledge what changed. If constraints conflict or no products match, explain why and suggest alternatives. Never be robotic.'
	),
	constraintApplied: z.string().describe(
		'The constraint extracted from the shopper message, phrased as a short label (e.g., "under $500", "leather only", "compact"). Used as a filter badge in the UI.'
	),
	constraintConflict: z.boolean().describe(
		'True if the new constraint conflicts with existing constraints or eliminates all products. The chatResponse should explain the conflict and what was done to resolve it.'
	),
});

export type RefineResponse = z.infer<typeof RefineResponseSchema>;

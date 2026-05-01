/**
 * Tag-intent helpers — ADR-008 Phase A.
 *
 * Tag intents are semantic tags extracted from a refinement-chat NL message
 * (e.g., "warm and cozy for lounging" → `[cozy, warm, casual]`). They are
 * vocabulary-constrained: the AI MUST emit tags that already exist in the
 * brand's enrichment vocabulary, and we post-validate to enforce that.
 *
 * Lives in src/lib/server because it pulls a DB-backed vocabulary; the helper
 * itself is pure, but it's wired up alongside server-side flows.
 */

const TAG_VOCAB_LIMIT = 200;

/**
 * Build the prompt fragment that conveys the brand's tag vocabulary to the
 * AI. Keeps the prompt token-budgeted: the vocabulary may grow without
 * bound as enrichment runs, so we cap to TAG_VOCAB_LIMIT and let the AI
 * pick from a representative sample. The full vocabulary is still enforced
 * post-validation, so the cap is a prompt-efficiency choice, not a
 * correctness one.
 *
 * Returns an empty string when the vocabulary is empty — caller should
 * still expect tagIntents=[] in the response (the AI follows the empty
 * vocabulary instruction).
 */
export function formatTagVocabularyForPrompt(vocabulary: string[]): string {
	if (vocabulary.length === 0) {
		return `\nBRAND TAG VOCABULARY: (empty — no enrichment tags available; return tagIntents=[])\n`;
	}
	const sample = vocabulary.length > TAG_VOCAB_LIMIT
		? vocabulary.slice(0, TAG_VOCAB_LIMIT)
		: vocabulary;
	return `\nBRAND TAG VOCABULARY (${sample.length}${vocabulary.length > sample.length ? `/${vocabulary.length}` : ''} tags):
${sample.map((t) => `- ${t}`).join('\n')}

TAG INTENT EXTRACTION RULES:
- Inspect the SHOPPER'S MESSAGE for concrete attribute intents (texture, vibe, occasion, material, fit, mood).
- Return ONLY tags from the BRAND TAG VOCABULARY above. Never invent tags. Never paraphrase ("comfy" is not "cozy" unless "cozy" is in the vocabulary).
- If the message is too generic to extract concrete intents (e.g., "show me stuff", "anything", "I don't know"), return tagIntents=[].
- Cap at 6 tags; pick the strongest matches.
- Tag intents are additive to persona ranking, not a replacement for it.\n`;
}

/**
 * Filter AI-emitted tag intents to only those that exist in the brand
 * vocabulary. Defensive against AI hallucination — even with the prompt
 * constraint above, an LLM may occasionally emit a tag the prompt didn't
 * advertise. We drop those silently (no error, no warning to the user).
 *
 * Also dedupes case-insensitively while preserving the canonical casing
 * from the vocabulary, and caps at 6 tags.
 */
export function filterToVocabulary(emitted: string[] | undefined, vocabulary: string[]): string[] {
	if (!emitted || emitted.length === 0) return [];
	const vocabLowerToCanonical = new Map<string, string>();
	for (const t of vocabulary) {
		vocabLowerToCanonical.set(t.toLowerCase(), t);
	}
	const seen = new Set<string>();
	const result: string[] = [];
	for (const raw of emitted) {
		const canonical = vocabLowerToCanonical.get(raw.toLowerCase());
		if (!canonical || seen.has(canonical)) continue;
		seen.add(canonical);
		result.push(canonical);
		if (result.length >= 6) break;
	}
	return result;
}

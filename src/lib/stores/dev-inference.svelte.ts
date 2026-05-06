/**
 * Client-side store for the dev-mode Inference Engine panel.
 *
 * Pages with AI zones populate this on mount via `setDevInference(...)`.
 * The global InferenceEnginePanel (mounted in +layout.svelte) renders
 * conditionally on the store having data + dev mode being active.
 *
 * Pages without AI zones never call set, so the panel stays hidden.
 */
import type { PersonaInference } from '$lib/signals/types';

export interface SessionContext {
	visitCount: number;
	storedPersona?: string | null;
	storedCategory?: string | null;
	searchQuery?: string | null;
}

export interface SessionCost {
	totalCost: number;
	generations: number;
	tokens: number;
	cacheHitRate: number;
}

export interface AiMeta {
	generationTimeMs: number;
	persona: string;
	cacheHit?: boolean;
}

export interface DevInferenceState {
	/** Surface label for the panel header (e.g. "Home", "PLP — Women", "Search"). */
	surface: string;
	inference: PersonaInference;
	aiMeta?: AiMeta | null;
	aiError?: string | null;
	sessionContext?: SessionContext | null;
	sessionCost?: SessionCost | null;
	/** Currently active persona (may be overridden by user via the panel). */
	currentPersona: string;
	/** Whether persona was set by user override (vs inference). */
	manualOverride: boolean;
}

let state = $state<DevInferenceState | null>(null);

export function setDevInference(next: DevInferenceState): void {
	state = next;
}

export function clearDevInference(): void {
	state = null;
}

export function getDevInference(): DevInferenceState | null {
	return state;
}

/**
 * Window-event-based bridge for persona override.
 * Pages own their persona state; the panel dispatches an event that the
 * current AI-zone page listens to. This keeps the store dumb (data only,
 * no actions) and the page in control of its own AI generation flow.
 */
export const PERSONA_OVERRIDE_EVENT = 'aisles-dev-persona-override';

export interface PersonaOverrideDetail {
	/** Persona id, or null to reset to inferred. */
	persona: string | null;
}

export function dispatchPersonaOverride(persona: string | null): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(
		new CustomEvent<PersonaOverrideDetail>(PERSONA_OVERRIDE_EVENT, { detail: { persona } }),
	);
}

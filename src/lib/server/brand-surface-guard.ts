import { error } from '@sveltejs/kit';
import { getBrand } from '$lib/brand/config';
import { assertBrandPolicySurface } from '$lib/brand/bealls-family-runtime-contract';
import type { EffectiveCompositionPolicy, PolicySurface } from '$lib/foundation/composition-policy';

/** Compile the trusted brand contract before route data or model work begins. */
export function requireBrandSurface(surface: PolicySurface): EffectiveCompositionPolicy {
	const brand = getBrand();
	try {
		return assertBrandPolicySurface(brand.id, surface);
	} catch {
		throw error(404, `${surface} is not available for ${brand.name}`);
	}
}

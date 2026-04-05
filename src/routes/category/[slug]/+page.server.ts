import type { PageServerLoad } from './$types';
import { getCategories, getProductsByCategory, customFieldsToRecord, type BCProduct } from '$lib/server/bigcommerce';
import { error } from '@sveltejs/kit';

/** Map BC category slugs to our category config */
const CATEGORY_MAP: Record<string, { bcName: string; displayName: string }> = {
	'living-room': { bcName: 'Haven Living Room', displayName: 'Living Room' },
	'office': { bcName: 'Haven Office', displayName: 'Office' },
};

export const load: PageServerLoad = async ({ params, url, cookies }) => {
	const slug = params.slug;
	const devMode = url.searchParams.get('dev') === 'true';

	const catConfig = CATEGORY_MAP[slug];
	if (!catConfig) {
		throw error(404, `Category "${slug}" not found`);
	}

	// Find the BC category by name
	const categories = await getCategories();
	const bcCategory = categories.find((c) => c.name === catConfig.bcName);

	if (!bcCategory) {
		throw error(404, `BigCommerce category "${catConfig.bcName}" not found`);
	}

	// Fetch products
	const { products: bcProducts } = await getProductsByCategory(bcCategory.entityId);
	const products = bcProducts.map((p) => transformProduct(p));

	// ─── Cross-Session Persona Detection ────────────────────────────
	const storedPersona = cookies.get('prism_persona') || null;
	const storedCategory = cookies.get('prism_last_category') || null;
	const visitCount = parseInt(cookies.get('prism_visits') || '0') + 1;

	const intentParam = url.searchParams.get('intent');
	const searchQuery = url.searchParams.get('q') || '';

	let persona = 'gatherer';
	let confidence = 0.6;
	let personaSource = 'default';
	let personaShift = false;

	if (intentParam) {
		// Explicit override — highest priority
		persona = intentParam;
		confidence = 0.9;
		personaSource = 'url-param';
	} else if (searchQuery) {
		// Search query signals — check for conflict with stored persona
		const queryPersona = detectPersonaFromQuery(searchQuery);

		if (queryPersona) {
			persona = queryPersona.persona;
			confidence = queryPersona.confidence;
			personaSource = 'search-query';

			// Detect persona SHIFT — current signals conflict with stored model
			if (storedPersona && storedPersona !== persona) {
				personaShift = true;
			}
		}
	} else if (storedPersona && storedCategory === slug) {
		// Returning visitor, same category — continuity (Act 2)
		persona = storedPersona;
		confidence = 0.85;
		personaSource = 'returning-visitor';
	} else if (storedPersona && storedCategory !== slug) {
		// Returning visitor, different category — soft continuity, lower confidence
		persona = storedPersona;
		confidence = 0.5;
		personaSource = 'returning-visitor-new-category';
	}

	// Store current session state in cookies
	cookies.set('prism_persona', persona, { path: '/', maxAge: 60 * 60 * 24 * 30 });
	cookies.set('prism_last_category', slug, { path: '/', maxAge: 60 * 60 * 24 * 30 });
	cookies.set('prism_visits', String(visitCount), { path: '/', maxAge: 60 * 60 * 24 * 30 });

	return {
		category: {
			slug,
			name: catConfig.displayName,
			description: '',
		},
		products,
		persona,
		confidence,
		devMode,
		// Cross-session context for dev mode
		sessionContext: {
			personaSource,
			personaShift,
			storedPersona,
			storedCategory,
			visitCount,
			searchQuery: searchQuery || null,
		},
	};
};

/** Detect persona from search query keywords */
function detectPersonaFromQuery(query: string): { persona: string; confidence: number } | null {
	const q = query.toLowerCase();

	if (/cheap|budget|deal|dorm|under \$|affordable|sale|discount/i.test(q)) {
		return { persona: 'hunter', confidence: 0.8 };
	}
	if (/review|compare|spec|vs|rating|best|versus/i.test(q)) {
		return { persona: 'researcher', confidence: 0.75 };
	}
	if (/gift|birthday|anniversary|present|for him|for her/i.test(q)) {
		return { persona: 'gifter', confidence: 0.8 };
	}
	if (/browse|explore|inspiration|ideas|modern|style/i.test(q)) {
		return { persona: 'gatherer', confidence: 0.7 };
	}

	return null;
}

/** Transform a BC product into the shape our layout components expect */
function transformProduct(p: BCProduct) {
	const specs = customFieldsToRecord(p);

	return {
		id: p.path.replace(/^\/|\/$/g, '') || String(p.entityId),
		entityId: p.entityId,
		name: p.name,
		price: p.prices.price.value,
		salePrice: p.prices.salePrice?.value || undefined,
		image: p.defaultImage?.url || '',
		imageAlt: p.defaultImage?.altText || p.name,
		description: stripHtml(p.description),
		specs,
		tags: Object.values(specs).slice(0, 3),
		category: p.categories.edges[0]?.node.name || '',
	};
}

function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, '').trim();
}

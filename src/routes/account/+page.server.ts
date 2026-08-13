import type { PageServerLoad } from './$types';
import type { Product } from '$lib/types';
import { getBrand } from '$lib/brand/config';
import { loadHomeProducts } from '$lib/server/catalog';
import { requireBrandSurface } from '$lib/server/brand-surface-guard';

/**
 * FND-009 — Account dashboard scaffold (Phase 1 closeout).
 *
 * Prototype scope: no real BC customer auth. The page renders
 * with mock customer state so the surface exists for walk-throughs and
 * later refactor through `account.welcome` + `account.dashboard-pick.{1..4}`
 * zones (Phase 5, per ADR-007). The for-you-row is a stub — Phase 6 wires
 * real persona-fit recommendations.
 */

const FOR_YOU_STUB: Product[] = [
	{
		id: 'stub-fy-001', entityId: 1, name: 'Featured pick #1', price: 49.99,
		image: '', imageAlt: '',
		description: '', specs: {}, tags: [], category: 'featured',
	},
	{
		id: 'stub-fy-002', entityId: 2, name: 'Featured pick #2', price: 79.99,
		image: '', imageAlt: '',
		description: '', specs: {}, tags: [], category: 'featured',
	},
	{
		id: 'stub-fy-003', entityId: 3, name: 'Featured pick #3', price: 34.99,
		image: '', imageAlt: '',
		description: '', specs: {}, tags: [], category: 'featured',
	},
	{
		id: 'stub-fy-004', entityId: 4, name: 'Featured pick #4', price: 124.0,
		image: '', imageAlt: '',
		description: '', specs: {}, tags: [], category: 'featured',
	},
];

export const load: PageServerLoad = async ({ cookies }) => {
	requireBrandSurface('account');
	const brand = getBrand();
	const persona = (cookies.get('aisles_persona') as
		| 'gatherer'
		| 'hunter'
		| 'researcher'
		| 'gifter'
		| undefined) ?? 'gatherer';

	let forYouProducts: Product[] = FOR_YOU_STUB;
	try {
		const { products: catalog } = await loadHomeProducts(persona, 12);
		if (catalog.length >= 4) forYouProducts = catalog.slice(0, 4);
	} catch (err) {
		console.warn('FND-009: loadHomeProducts failed, falling back to stub', err);
	}

	const customer = {
		firstName: 'Sara',
		memberSince: '2024',
		tier: { current: 'Gold', next: 'Platinum', unitsToNext: 240 },
		bucksBalance: 12,
	};

	const recentOrders = [
		{ id: '#10428', placed: '2026-04-22', status: 'Delivered', itemCount: 3, total: 84.45 },
		{ id: '#10391', placed: '2026-04-08', status: 'Delivered', itemCount: 1, total: 29.99 },
		{ id: '#10342', placed: '2026-03-26', status: 'Delivered', itemCount: 2, total: 56.0 },
	];

	return {
		customer,
		recentOrders,
		forYouProducts,
		persona,
		brandName: brand.name,
	};
};

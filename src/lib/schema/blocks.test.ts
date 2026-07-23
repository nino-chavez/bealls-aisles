/**
 * P0 marketing/capture/service block schemas — validation roundtrip tests.
 *
 * Run: npx tsx src/lib/schema/blocks.test.ts
 *
 * Covers PRD-ENG-020 schema set: every new block parses representative
 * fixtures, rejects malformed input, and the StorefrontBlocks union
 * still produces a single discriminated union (no duplicate component
 * literals).
 */

import { z } from 'zod';
import {
	EventCountdownSection,
	BrandSpotlightSection,
	TrendShopSection,
	EmailCaptureInlineSection,
	ServiceCalloutsGridSection,
	LocatorStripSection,
	StorefrontBlocks,
} from './blocks';

let passed = 0;
let failed = 0;
function assert(name: string, condition: boolean, detail = '') {
	if (condition) {
		console.log(`  PASS  ${name}`);
		passed++;
	} else {
		console.error(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
		failed++;
	}
}

// ─── event-countdown ───────────────────────────────────────────────

console.log('\nevent-countdown');
{
	const fixture = {
		component: 'event-countdown',
		props: {
			eyebrow: 'MEMORIAL DAY WEEKEND',
			headline: 'Up to 70% off — Fri thru Mon',
			endsAt: '2026-05-26T23:59:59-05:00',
			ctaLabel: 'Shop the Event',
			ctaHref: '/category/clearance',
		},
	};
	const result = EventCountdownSection.safeParse(fixture);
	assert('parses valid event-countdown fixture', result.success, result.success ? '' : JSON.stringify(result.error.issues));

	const missingHeadline = { component: 'event-countdown', props: { endsAt: '2026-05-26T23:59:59Z' } };
	assert('rejects missing headline', !EventCountdownSection.safeParse(missingHeadline).success);

	const missingEndsAt = { component: 'event-countdown', props: { headline: 'Sale' } };
	assert('rejects missing endsAt', !EventCountdownSection.safeParse(missingEndsAt).success);
}

// ─── brand-spotlight ───────────────────────────────────────────────

console.log('\nbrand-spotlight');
{
	const fixture = {
		component: 'brand-spotlight',
		props: {
			brandName: 'Reel Legends',
			eyebrow: 'FEATURED BRAND',
			headline: 'Built for the dock',
			body: 'Performance-fishing apparel from a Florida original.',
			image: 'https://cdn11.bigcommerce.com/foo.jpg',
			ctaLabel: 'Shop Reel Legends',
			ctaHref: '/category/reel-legends',
		},
	};
	const result = BrandSpotlightSection.safeParse(fixture);
	assert('parses valid brand-spotlight fixture', result.success, result.success ? '' : JSON.stringify(result.error.issues));

	const missingBody = { component: 'brand-spotlight', props: { brandName: 'X', headline: 'h', image: 'i' } };
	assert('rejects missing body', !BrandSpotlightSection.safeParse(missingBody).success);
}

// ─── trend-shop ────────────────────────────────────────────────────

console.log('\ntrend-shop');
{
	const fixture = {
		component: 'trend-shop',
		props: {
			sectionLabel: 'SHOP THE TREND',
			headline: 'The Vacation Shop',
			image: 'https://cdn11.bigcommerce.com/vacation.jpg',
			ctaLabel: 'Shop Vacation',
			ctaHref: '/category/vacation',
		},
	};
	const result = TrendShopSection.safeParse(fixture);
	assert('parses valid trend-shop fixture', result.success, result.success ? '' : JSON.stringify(result.error.issues));

	const missingCta = { component: 'trend-shop', props: { headline: 'X', image: 'i' } };
	assert('rejects missing ctaLabel/ctaHref', !TrendShopSection.safeParse(missingCta).success);
}

// ─── email-capture-inline ──────────────────────────────────────────

console.log('\nemail-capture-inline');
{
	const fixture = {
		component: 'email-capture-inline',
		props: {
			eyebrow: 'JOIN US',
			headline: 'Sign up for emails',
			body: 'Be the first to know about events, drops, and rewards.',
			offerCopy: 'Use code WELCOME10 — $10 off your first order.',
			ctaLabel: 'Sign Up',
			privacyNote: 'We never share your email.',
		},
	};
	const result = EmailCaptureInlineSection.safeParse(fixture);
	assert('parses valid email-capture-inline fixture', result.success, result.success ? '' : JSON.stringify(result.error.issues));

	const minimalFixture = {
		component: 'email-capture-inline',
		props: { headline: 'h', ctaLabel: 'Sign Up' },
	};
	assert('parses minimal fixture', EmailCaptureInlineSection.safeParse(minimalFixture).success);
}

// ─── service-callouts-grid ─────────────────────────────────────────

console.log('\nservice-callouts-grid');
{
	const fixture = {
		component: 'service-callouts-grid',
		props: {
			columns: 4,
			callouts: [
				{ icon: '🚚', label: 'Free shipping', body: 'On orders $99+' },
				{ icon: '↩️', label: 'Easy returns', body: '30 days' },
				{ icon: '🏬', label: 'Buy online, pick up', body: 'Ready in 2 hours' },
				{ icon: '💎', label: 'Bealls Bucks rewards' },
			],
		},
	};
	const result = ServiceCalloutsGridSection.safeParse(fixture);
	assert('parses valid service-callouts-grid fixture', result.success, result.success ? '' : JSON.stringify(result.error.issues));

	const tooFew = { component: 'service-callouts-grid', props: { columns: 3, callouts: [{ icon: '🚚', label: 'X' }] } };
	assert('rejects fewer than 3 callouts', !ServiceCalloutsGridSection.safeParse(tooFew).success);

	const wrongColumns = { component: 'service-callouts-grid', props: { columns: 5, callouts: [{ icon: 'a', label: 'a' }, { icon: 'b', label: 'b' }, { icon: 'c', label: 'c' }] } };
	assert('rejects columns outside 3|4', !ServiceCalloutsGridSection.safeParse(wrongColumns).success);
}

// ─── locator-strip ─────────────────────────────────────────────────

console.log('\nlocator-strip');
{
	const fixture = {
		component: 'locator-strip',
		props: {
			eyebrow: 'FIND A STORE',
			headline: 'Visit your nearest Bealls',
			body: 'Pickup, returns, and styling help in person.',
			ctaLabel: 'Find a Store',
			ctaHref: '/store-locator',
		},
	};
	const result = LocatorStripSection.safeParse(fixture);
	assert('parses valid locator-strip fixture', result.success, result.success ? '' : JSON.stringify(result.error.issues));

	const missingCtaHref = { component: 'locator-strip', props: { headline: 'X', ctaLabel: 'Find a store' } };
	assert('rejects missing ctaHref', !LocatorStripSection.safeParse(missingCtaHref).success);
}

// ─── StorefrontBlocks union integrity ──────────────────────────────

console.log('\nStorefrontBlocks union integrity');
{
	const StorefrontUnion = z.discriminatedUnion('component', [...StorefrontBlocks]);
	const components = new Set<string>();
	for (const block of StorefrontBlocks) {
		const literal = (block.shape.component as z.ZodLiteral<string>).def.values[0];
		assert(`component literal "${literal}" is unique`, !components.has(literal));
		components.add(literal);
	}

	const sampleFixtures = [
		{ component: 'event-countdown', props: { headline: 'X', endsAt: '2026-05-26T23:59:59Z' } },
		{ component: 'brand-spotlight', props: { brandName: 'X', headline: 'h', body: 'b', image: 'i' } },
		{ component: 'trend-shop', props: { headline: 'X', image: 'i', ctaLabel: 'go', ctaHref: '/' } },
		{ component: 'email-capture-inline', props: { headline: 'X', ctaLabel: 'Sign up' } },
		{
			component: 'service-callouts-grid',
			props: { columns: 3, callouts: [{ icon: 'a', label: 'a' }, { icon: 'b', label: 'b' }, { icon: 'c', label: 'c' }] },
		},
		{ component: 'locator-strip', props: { headline: 'X', ctaLabel: 'Find a store', ctaHref: '/store-locator' } },
	];
	for (const fixture of sampleFixtures) {
		assert(`union accepts ${fixture.component}`, StorefrontUnion.safeParse(fixture).success);
	}
}

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);

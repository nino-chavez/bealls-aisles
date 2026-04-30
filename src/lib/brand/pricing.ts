/**
 * Brand-aware price formatting.
 *
 * Standard mode: regular strikethrough price → sale price.
 * Off-price mode: "Comparable value $X" label + "You save X%" (Bealls family).
 *
 * The function returns a normalized shape that components can render uniformly
 * regardless of brand, but with brand-specific labeling.
 */

import { getBrand } from './config';

export interface FormattedPrice {
	/** The price the shopper actually pays (sale or regular). */
	displayPrice: string;
	/** Strikethrough/comparable-value price, undefined if no markdown. */
	comparablePrice?: string;
	/** Label preceding the comparable price ("Comparable value", "Was", or empty). */
	comparableLabel?: string;
	/** Savings percentage badge ("You save 50%"), undefined if no markdown or below threshold. */
	savingsLabel?: string;
}

export function formatPrice(price: number, salePrice?: number | null): FormattedPrice {
	const brand = getBrand();
	const style = brand.pricingStyle ?? 'standard';

	const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

	// No markdown — return single price.
	if (!salePrice || salePrice >= price) {
		return { displayPrice: fmt(price) };
	}

	const savedPct = Math.round(((price - salePrice) / price) * 100);

	if (style === 'off-price') {
		return {
			displayPrice: fmt(salePrice),
			comparablePrice: fmt(price),
			comparableLabel: 'Comparable value',
			savingsLabel: savedPct >= 10 ? `You save ${savedPct}%` : undefined,
		};
	}

	// Standard: just strikethrough
	return {
		displayPrice: fmt(salePrice),
		comparablePrice: fmt(price),
		comparableLabel: undefined,
		savingsLabel: undefined,
	};
}

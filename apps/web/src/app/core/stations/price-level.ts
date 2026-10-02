/** Where a price lies within the prices currently shown, for coloring the map's price tags. */
export type PriceLevel = 'low' | 'medium' | 'high';

export interface PriceRange {
  minimumInEuro: number;
  maximumInEuro: number;
}

export const priceRangeOf = (prices: readonly (number | null)[]): PriceRange | undefined => {
  const knownPrices = prices.filter(price => price !== null);
  if (knownPrices.length === 0) {
    return undefined;
  }
  return { minimumInEuro: Math.min(...knownPrices), maximumInEuro: Math.max(...knownPrices) };
};

/**
 * Splits the range into thirds: cheaper third "low", dearer third "high". Without a spread every
 * price is "low", so equal prices do not look expensive.
 */
export const priceLevelOf = (priceInEuro: number, range: PriceRange): PriceLevel => {
  const spread = range.maximumInEuro - range.minimumInEuro;
  if (spread <= 0) {
    return 'low';
  }
  const share = (priceInEuro - range.minimumInEuro) / spread;
  if (share <= 1 / 3) {
    return 'low';
  }
  return share < 2 / 3 ? 'medium' : 'high';
};

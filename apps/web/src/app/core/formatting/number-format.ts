import { METERS_PER_KILOMETER } from '@genialtanken/contracts';

const LOCALE = 'de-DE';

const PRICE_FORMAT = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const DISTANCE_FORMAT = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export interface PriceParts {
  /** "1,85" */
  leadingDigits: string;
  /** "9" — fuel prices show their tenth of a cent raised, as at the pump. */
  tenthOfCent: string;
}

/** 1.859 → { leadingDigits: '1,85', tenthOfCent: '9' } */
export const formatPriceParts = (priceInEuro: number): PriceParts => {
  const formattedPrice = PRICE_FORMAT.format(priceInEuro);
  return {
    leadingDigits: formattedPrice.slice(0, -1),
    tenthOfCent: formattedPrice.slice(-1),
  };
};

/** 1.859 → "1,859 €" (plain text, e.g. for accessible names). */
export const formatPrice = (priceInEuro: number): string => `${PRICE_FORMAT.format(priceInEuro)} €`;

/** Keeps number and unit on one line. */
const NO_BREAK_SPACE = '\u00a0';

const withKilometerUnit = (formattedNumber: string): string =>
  `${formattedNumber}${NO_BREAK_SPACE}km`;

/** 5 → "5 km" with a no-break space, e.g. for search radii. */
export const formatKilometers = (kilometers: number): string =>
  withKilometerUnit(String(kilometers));

/** 1949 → "1,95 km" with a no-break space. */
export const formatDistance = (distanceInMeters: number): string =>
  withKilometerUnit(DISTANCE_FORMAT.format(distanceInMeters / METERS_PER_KILOMETER));

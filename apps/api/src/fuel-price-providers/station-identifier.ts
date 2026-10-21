import { STATION_IDENTIFIER_PATTERN, type CountryCode } from '@genialtanken/contracts';
import { z } from 'zod';
import { ERROR_MESSAGES } from '../common/error-messages.js';

export { STATION_IDENTIFIER_PATTERN };

export const stationIdentifierSchema = z
  .string()
  .regex(STATION_IDENTIFIER_PATTERN, ERROR_MESSAGES.invalidStationIdentifier);

const SEPARATOR = '-';

export type CountryPrefix = Lowercase<CountryCode>;

export interface StationIdentifierParts {
  /** Taken from the identifier as is, so it may name a country without a provider. */
  countryPrefix: string;
  localIdentifier: string;
}

// A lookup instead of `toLowerCase()`, which is typed as returning any `string`. The mapped type
// makes the compiler demand an entry for every new country.
const COUNTRY_PREFIXES: { readonly [Code in CountryCode]: Lowercase<Code> } = {
  FR: 'fr',
};

export const toCountryPrefix = (country: CountryCode): CountryPrefix => COUNTRY_PREFIXES[country];

export const toStationIdentifier = (country: CountryCode, localIdentifier: string): string =>
  `${toCountryPrefix(country)}${SEPARATOR}${localIdentifier}`;

/** Expects an identifier matching `STATION_IDENTIFIER_PATTERN`. */
export const splitStationIdentifier = (identifier: string): StationIdentifierParts => {
  const separatorIndex = identifier.indexOf(SEPARATOR);
  return {
    countryPrefix: identifier.slice(0, separatorIndex),
    localIdentifier: identifier.slice(separatorIndex + SEPARATOR.length),
  };
};

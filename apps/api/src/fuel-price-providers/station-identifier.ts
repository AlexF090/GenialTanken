import { STATION_IDENTIFIER_PATTERN, type CountryCode } from '@genialtanken/contracts';
import { z } from 'zod';

export { STATION_IDENTIFIER_PATTERN };

export const stationIdentifierSchema = z
  .string()
  .regex(STATION_IDENTIFIER_PATTERN, 'Station identifiers look like "fr-92242003".');

const SEPARATOR = '-';

export interface StationIdentifierParts {
  countryPrefix: string;
  localIdentifier: string;
}

export const toStationIdentifier = (country: CountryCode, localIdentifier: string): string =>
  `${country.toLowerCase()}${SEPARATOR}${localIdentifier}`;

export const toCountryPrefix = (country: CountryCode): string => country.toLowerCase();

/** Expects an identifier matching `STATION_IDENTIFIER_PATTERN`. */
export const splitStationIdentifier = (identifier: string): StationIdentifierParts => {
  const separatorIndex = identifier.indexOf(SEPARATOR);
  return {
    countryPrefix: identifier.slice(0, separatorIndex),
    localIdentifier: identifier.slice(separatorIndex + SEPARATOR.length),
  };
};

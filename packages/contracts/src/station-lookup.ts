import * as z from 'zod';
import { stationSchema } from './station.js';

/** `<lowercase country code>-<identifier of the provider>`, e.g. `fr-92242003`. */
export const STATION_IDENTIFIER_PATTERN = /^[a-z]{2}-[A-Za-z0-9-]+$/;

export const MAXIMUM_STATION_IDENTIFIERS_PER_REQUEST = 50;

const IDENTIFIER_SEPARATOR = ',';

const toUniqueIdentifiers = (identifiers: string): string[] => [
  ...new Set(
    identifiers
      .split(IDENTIFIER_SEPARATOR)
      .map(identifier => identifier.trim())
      .filter(identifier => identifier.length > 0)
  ),
];

/** Query parameters of the bulk station lookup, e.g. `?identifiers=fr-92242003,fr-75001001`. */
export const stationLookupQuerySchema = z.object({
  identifiers: z
    .string()
    .transform(toUniqueIdentifiers)
    .pipe(
      z
        .array(z.string().regex(STATION_IDENTIFIER_PATTERN))
        .min(1)
        .max(MAXIMUM_STATION_IDENTIFIERS_PER_REQUEST)
    ),
});

export type StationLookupQuery = z.infer<typeof stationLookupQuerySchema>;

/** Answer of the bulk station lookup; every requested identifier lands in exactly one list. */
export const stationLookupSchema = z.object({
  stations: z.array(stationSchema),
  /** Identifiers the providers do not know (any more). */
  unavailableIdentifiers: z.array(z.string()),
  /** Identifiers whose provider could not be reached; worth retrying later. */
  failedIdentifiers: z.array(z.string()),
});

export type StationLookup = z.infer<typeof stationLookupSchema>;

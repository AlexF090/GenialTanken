import type { Coordinates, FuelType } from '@genialtanken/contracts';

/** Request URLs the app sends to its API, for `HttpTestingController.expectOne`. */
export const STATIONS_URL = '/api/stations';
export const PLACES_URL = '/api/places';

export interface StationsUrlOptions {
  radiusInKilometers?: number;
  fuel?: FuelType;
}

/** Stations around a point; defaults to the default settings (5 km, E5). */
export const stationsUrl = (
  { latitude, longitude }: Coordinates,
  { radiusInKilometers = 5, fuel = 'e5' }: StationsUrlOptions = {}
): string =>
  `${STATIONS_URL}?latitude=${String(latitude)}&longitude=${String(longitude)}&radiusInKilometers=${String(radiusInKilometers)}&fuel=${fuel}`;

export const stationUrl = (stationIdentifier: string): string =>
  `${STATIONS_URL}/${stationIdentifier}`;

/** `identifiers` comma-separated, as the app sends them. */
export const stationLookupUrl = (identifiers: string): string =>
  `${STATIONS_URL}/by-identifiers?identifiers=${identifiers}`;

export const placesUrl = (query: string): string =>
  `${PLACES_URL}?query=${encodeURIComponent(query)}&limit=6`;

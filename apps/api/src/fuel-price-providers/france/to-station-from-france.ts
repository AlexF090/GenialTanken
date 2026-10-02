import type { FuelType, Station } from '@genialtanken/contracts';
import { toStationIdentifier } from '../station-identifier.js';
import type { FrenchPriceField, FrenchRecord } from './french-record.schema.js';
import { parseFrenchOpeningHours } from './parse-french-opening-hours.js';

export const FRENCH_PRICE_FIELDS: Readonly<Record<FuelType, FrenchPriceField>> = {
  e5: 'sp95_prix',
  e10: 'e10_prix',
  superPlus: 'sp98_prix',
  diesel: 'gazole_prix',
  e85: 'e85_prix',
  lpg: 'gplc_prix',
};

const toPrice = (price: number | null | undefined): number | null =>
  price !== null && price !== undefined && price > 0 ? price : null;

export const toStationFromFrance = (record: FrenchRecord): Station => ({
  id: toStationIdentifier('FR', String(record.id)),
  country: 'FR',
  name: null,
  brand: null,
  address: {
    street: record.adresse ?? '',
    houseNumber: null,
    postalCode: record.cp ?? '',
    city: record.ville ?? '',
    latitude: record.geom.lat,
    longitude: record.geom.lon,
  },
  pricesInEuro: {
    e5: toPrice(record[FRENCH_PRICE_FIELDS.e5]),
    e10: toPrice(record[FRENCH_PRICE_FIELDS.e10]),
    superPlus: toPrice(record[FRENCH_PRICE_FIELDS.superPlus]),
    diesel: toPrice(record[FRENCH_PRICE_FIELDS.diesel]),
    e85: toPrice(record[FRENCH_PRICE_FIELDS.e85]),
    lpg: toPrice(record[FRENCH_PRICE_FIELDS.lpg]),
  },
  isOpen: null,
  openingTimes: parseFrenchOpeningHours(record.horaires),
  distanceInMeters:
    record.distance_in_meters === undefined ? null : Math.round(record.distance_in_meters),
});

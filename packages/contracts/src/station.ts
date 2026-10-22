import * as z from 'zod';
import { latitudeSchema, longitudeSchema } from './coordinates.js';
import { openingTimesSchema } from './opening-times.js';
import { fuelTypeSchema } from './stations-query.js';

const priceInEuroSchema = z.number().positive().nullable();

export const COUNTRY_CODES = ['FR'] as const;

export const countryCodeSchema = z.enum(COUNTRY_CODES);

export type CountryCode = z.infer<typeof countryCodeSchema>;

/** Station as returned by the GenialTanken API to the web app. */
export const stationSchema = z.object({
  /** Provider-namespaced identifier, e.g. `fr-92242003`; treat as opaque. */
  id: z.string().min(1),
  country: countryCodeSchema,
  /** `null` when the data source publishes no station name (French open data). */
  name: z.string().nullable(),
  brand: z.string().nullable(),
  address: z.object({
    street: z.string(),
    houseNumber: z.string().nullable(),
    postalCode: z.string(),
    city: z.string(),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
  }),
  /** One entry per fuel type (exhaustive); `null` when the station reports no price. */
  pricesInEuro: z.record(fuelTypeSchema, priceInEuroSchema),
  /** `null` when the data source publishes no live opening status. */
  isOpen: z.boolean().nullable(),
  openingTimes: openingTimesSchema,
  /** `null` when the distance to the requested position is unknown (detail requests). */
  distanceInMeters: z.number().nonnegative().nullable(),
});

export const stationsSchema = z.array(stationSchema);

export type Station = z.infer<typeof stationSchema>;

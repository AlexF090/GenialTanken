import * as z from 'zod';
import { countryCodeSchema } from './station.js';

export const MINIMUM_PLACE_QUERY_LENGTH = 3;
export const MAXIMUM_PLACE_QUERY_LENGTH = 100;
export const DEFAULT_PLACE_LIMIT = 6;
export const MAXIMUM_PLACE_LIMIT = 10;

/** Query parameters of `GET /api/places`; values arrive as strings and are coerced. */
export const placesQuerySchema = z.object({
  query: z.string().trim().min(MINIMUM_PLACE_QUERY_LENGTH).max(MAXIMUM_PLACE_QUERY_LENGTH),
  limit: z.coerce.number().int().min(1).max(MAXIMUM_PLACE_LIMIT).default(DEFAULT_PLACE_LIMIT),
});

export type PlacesQuery = z.infer<typeof placesQuerySchema>;

/** Place suggestion returned by the GenialTanken API for the place search. */
export const placeSchema = z.object({
  /** Source-namespaced identifier, e.g. `N123456`; treat as opaque. */
  id: z.string().min(1),
  /** Primary line, e.g. `Place de la Bastille` or `Kassel`. */
  name: z.string().min(1),
  /** Secondary line in German, e.g. `75011 Paris, Frankreich`. */
  description: z.string(),
  country: countryCodeSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const placesSchema = z.array(placeSchema);

export type Place = z.infer<typeof placeSchema>;

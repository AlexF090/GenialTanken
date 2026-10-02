import { z } from 'zod';

export const FUEL_TYPES = ['e5', 'e10', 'diesel'] as const;

export const fuelTypeSchema = z.enum(FUEL_TYPES);

export type FuelType = z.infer<typeof fuelTypeSchema>;

export const DEFAULT_FUEL_TYPE: FuelType = 'e5';

export const MINIMUM_RADIUS_IN_KILOMETERS = 1;
export const MAXIMUM_RADIUS_IN_KILOMETERS = 25;
export const DEFAULT_RADIUS_IN_KILOMETERS = 5;

/** Query parameters of `GET /api/stations`; values arrive as strings and are coerced. */
export const stationsQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusInKilometers: z.coerce
    .number()
    .min(MINIMUM_RADIUS_IN_KILOMETERS)
    .max(MAXIMUM_RADIUS_IN_KILOMETERS)
    .default(DEFAULT_RADIUS_IN_KILOMETERS),
  fuel: fuelTypeSchema.default(DEFAULT_FUEL_TYPE),
});

export type StationsQuery = z.infer<typeof stationsQuerySchema>;

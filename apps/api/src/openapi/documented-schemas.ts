import {
  apiErrorSchema,
  placeSchema,
  stationLookupSchema,
  stationSchema,
} from '@genialtanken/contracts';
import { z } from 'zod';

/** Contract schemas with an id, so the OpenAPI document lists them as named components. */
export const documentedStationSchema = stationSchema.meta({ id: 'Station' });

/** Refers to the `Station` component instead of repeating the station schema inline. */
export const documentedStationLookupSchema = stationLookupSchema
  .extend({ stations: z.array(documentedStationSchema) })
  .meta({ id: 'StationLookup' });

export const documentedPlaceSchema = placeSchema.meta({ id: 'Place' });

export const documentedApiErrorSchema = apiErrorSchema.meta({ id: 'ApiError' });

/** Body of `GET /health`, which checks liveness only and therefore lists no indicators. */
export const documentedHealthCheckSchema = z
  .object({
    status: z.literal('ok'),
    info: z.record(z.string(), z.unknown()),
    error: z.record(z.string(), z.unknown()),
    details: z.record(z.string(), z.unknown()),
  })
  .meta({ id: 'HealthCheck' });

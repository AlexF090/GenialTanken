import { apiErrorSchema, placeSchema, stationSchema } from '@genialtanken/contracts';

/** Contract schemas with an id, so the OpenAPI document lists them as named components. */
export const documentedStationSchema = stationSchema.meta({ id: 'Station' });

export const documentedPlaceSchema = placeSchema.meta({ id: 'Place' });

export const documentedApiErrorSchema = apiErrorSchema.meta({ id: 'ApiError' });

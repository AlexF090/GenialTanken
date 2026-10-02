import { z } from 'zod';

const priceInEuroSchema = z.number().positive().nullable();

const openingIntervalSchema = z.object({
  opening: z.string(),
  closing: z.string(),
});

const openingDaySchema = z.array(openingIntervalSchema);

/** Station as returned by the GenialTanken API to the web app. */
export const stationSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  brand: z.string().nullable(),
  address: z.object({
    street: z.string(),
    houseNumber: z.string().nullable(),
    postalCode: z.string(),
    city: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }),
  /** `null` when the station does not sell this fuel or reports no price. */
  pricesInEuro: z.object({
    e5: priceInEuroSchema,
    e10: priceInEuroSchema,
    diesel: priceInEuroSchema,
  }),
  isOpen: z.boolean(),
  openingTimes: z.object({
    monday: openingDaySchema,
    tuesday: openingDaySchema,
    wednesday: openingDaySchema,
    thursday: openingDaySchema,
    friday: openingDaySchema,
    saturday: openingDaySchema,
    sunday: openingDaySchema,
    publicHoliday: openingDaySchema,
  }),
  /** `null` when the distance to the requested position is unknown (detail requests). */
  distanceInMeters: z.number().nonnegative().nullable(),
});

export const stationsSchema = z.array(stationSchema);

export type Station = z.infer<typeof stationSchema>;

export type OpeningTimes = Station['openingTimes'];

/** Error body of every non-2xx API response. */
export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  message: z.string(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

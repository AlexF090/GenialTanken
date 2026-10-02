import { z } from 'zod';

/**
 * Station as returned by the tankentanken API (`/gas-stations`, `/gas-stations/:id`).
 * Only the fields the app uses are kept; unknown fields are stripped.
 */
const upstreamFuelPriceSchema = z
  .object({
    price: z.number().positive(),
    lastChange: z.string(),
  })
  .nullable();

const openingIntervalSchema = z.object({
  opening: z.string(),
  closing: z.string(),
});

export const tankenTankenStationSchema = z.object({
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
  fuelPrices: z.object({
    e5: upstreamFuelPriceSchema,
    e10: upstreamFuelPriceSchema,
    diesel: upstreamFuelPriceSchema,
  }),
  isOpen: z.boolean(),
  openingTimes: z.object({
    monday: z.array(openingIntervalSchema),
    tuesday: z.array(openingIntervalSchema),
    wednesday: z.array(openingIntervalSchema),
    thursday: z.array(openingIntervalSchema),
    friday: z.array(openingIntervalSchema),
    saturday: z.array(openingIntervalSchema),
    sunday: z.array(openingIntervalSchema),
    publicHoliday: z.array(openingIntervalSchema),
  }),
});

export const tankenTankenStationsSchema = z.array(tankenTankenStationSchema);

export type TankenTankenStation = z.infer<typeof tankenTankenStationSchema>;

import { z } from 'zod';

const priceSchema = z.number().nullish();

/**
 * Record of the dataset `prix-des-carburants-en-france-flux-instantane-v2` on
 * data.economie.gouv.fr. Only the fields the app uses are kept; unknown fields are stripped.
 */
export const frenchRecordSchema = z.object({
  id: z.number().int().nonnegative(),
  adresse: z.string().nullish(),
  ville: z.string().nullish(),
  cp: z.string().nullish(),
  geom: z.object({ lon: z.number(), lat: z.number() }),
  /** JSON-encoded opening hours, see `parseFrenchOpeningHours`. */
  horaires: z.string().nullish(),
  gazole_prix: priceSchema,
  sp95_prix: priceSchema,
  e10_prix: priceSchema,
  sp98_prix: priceSchema,
  e85_prix: priceSchema,
  gplc_prix: priceSchema,
});

export type FrenchRecord = z.infer<typeof frenchRecordSchema>;

export type FrenchPriceField =
  'gazole_prix' | 'sp95_prix' | 'e10_prix' | 'sp98_prix' | 'e85_prix' | 'gplc_prix';

/** Records are validated one by one, so a single malformed record does not hide the others. */
export const frenchRecordsResponseSchema = z.object({
  total_count: z.number().int().nonnegative(),
  results: z.array(z.unknown()),
});

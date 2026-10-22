import { latitudeSchema, longitudeSchema } from '@genialtanken/contracts';
import { z } from 'zod';

/** Feature of a Photon (komoot) search answer; only the fields the place search reads. */
const photonFeatureSchema = z.object({
  type: z.literal('Feature'),
  properties: z.looseObject({
    /** `N` (node), `W` (way) or `R` (relation). */
    osm_type: z.string().min(1),
    osm_id: z.number().int(),
    name: z.string().optional(),
    street: z.string().optional(),
    housenumber: z.string().optional(),
    postcode: z.string().optional(),
    city: z.string().optional(),
    /** ISO 3166-1 alpha-2, e.g. `FR`. */
    countrycode: z.string().optional(),
    type: z.string().optional(),
  }),
  geometry: z.object({
    type: z.literal('Point'),
    /**
     * GeoJSON order: longitude first. Range-checked so a feature with impossible coordinates is
     * dropped, not sent to the web app.
     */
    coordinates: z.tuple([longitudeSchema, latitudeSchema]),
  }),
});

/**
 * GeoJSON FeatureCollection returned by Photon's `GET /api`. The features stay unchecked here;
 * `parsePhotonFeatures` validates them one by one.
 */
export const photonResponseSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(z.unknown()),
});

export type PhotonFeature = z.infer<typeof photonFeatureSchema>;

/** Drops malformed features one by one, so a single one does not hide the others. */
export const parsePhotonFeatures = (features: readonly unknown[]): PhotonFeature[] =>
  features.flatMap(feature => {
    const parsed = photonFeatureSchema.safeParse(feature);
    return parsed.success ? [parsed.data] : [];
  });

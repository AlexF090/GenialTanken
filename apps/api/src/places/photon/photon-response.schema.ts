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
    /** GeoJSON order: longitude first. */
    coordinates: z.tuple([z.number(), z.number()]),
  }),
});

/** GeoJSON FeatureCollection returned by Photon's `GET /api`. */
export const photonResponseSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(photonFeatureSchema),
});

export type PhotonFeature = z.infer<typeof photonFeatureSchema>;

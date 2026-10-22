import * as z from 'zod';

export const latitudeSchema = z.number().min(-90).max(90);

export const longitudeSchema = z.number().min(-180).max(180);

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Mean Earth radius (IUGG). */
const EARTH_RADIUS_IN_METERS = 6_371_008.8;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle distance via the haversine formula. */
export const distanceInMeters = (from: Coordinates, to: Coordinates): number => {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_IN_METERS * Math.asin(Math.sqrt(haversine));
};

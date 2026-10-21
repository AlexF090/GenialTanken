import { METERS_PER_KILOMETER } from '@genialtanken/contracts';
import type { Coordinates } from '../geolocation/coordinates';

const EARTH_RADIUS_IN_METERS = 6_371_000;
/** Moving the map by less than this share of the radius is not worth a new search. */
const MINIMUM_SHIFT_AS_SHARE_OF_RADIUS = 0.25;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle distance (haversine formula). */
export const distanceInMetersBetween = (first: Coordinates, second: Coordinates): number => {
  const latitudeDifference = toRadians(second.latitude - first.latitude);
  const longitudeDifference = toRadians(second.longitude - first.longitude);
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(first.latitude)) *
      Math.cos(toRadians(second.latitude)) *
      Math.sin(longitudeDifference / 2) ** 2;
  return 2 * EARTH_RADIUS_IN_METERS * Math.asin(Math.sqrt(haversine));
};

/**
 * Whether to offer "In diesem Bereich suchen": only once the visible map center has moved away
 * from the search center by a noticeable part of the radius.
 */
export const shouldOfferAreaSearch = (
  searchCenter: Coordinates,
  visibleMapCenter: Coordinates | undefined,
  radiusInKilometers: number
): boolean =>
  visibleMapCenter !== undefined &&
  distanceInMetersBetween(searchCenter, visibleMapCenter) >
    radiusInKilometers * METERS_PER_KILOMETER * MINIMUM_SHIFT_AS_SHARE_OF_RADIUS;

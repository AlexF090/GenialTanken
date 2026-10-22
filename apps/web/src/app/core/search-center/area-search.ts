import { distanceInMeters, METERS_PER_KILOMETER } from '@genialtanken/contracts';
import type { Coordinates } from '@genialtanken/contracts';

/** Moving the map by less than this share of the radius is not worth a new search. */
const MINIMUM_SHIFT_AS_SHARE_OF_RADIUS = 0.25;

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
  distanceInMeters(searchCenter, visibleMapCenter) >
    radiusInKilometers * METERS_PER_KILOMETER * MINIMUM_SHIFT_AS_SHARE_OF_RADIUS;

import { METERS_PER_KILOMETER } from '@genialtanken/contracts';
import type { Coordinates } from '@genialtanken/contracts';
import { L } from './leaflet';

/** Space in pixels covered by overlays (list panel, bottom sheet) on each side of the map. */
export interface ViewportPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_VIEWPORT_PADDING: ViewportPadding = { top: 0, right: 0, bottom: 0, left: 0 };

/** Keeps the radius circle and revealed markers off the very edge of the visible map. */
export const EDGE_SPACING_IN_PIXELS = 24;

export const toPaddingOptions = (
  padding: ViewportPadding
): Pick<L.FitBoundsOptions, 'paddingTopLeft' | 'paddingBottomRight'> => ({
  paddingTopLeft: [padding.left + EDGE_SPACING_IN_PIXELS, padding.top + EDGE_SPACING_IN_PIXELS],
  paddingBottomRight: [
    padding.right + EDGE_SPACING_IN_PIXELS,
    padding.bottom + EDGE_SPACING_IN_PIXELS,
  ],
});

/** Offset of the visible area's center from the map container's center, in pixels. */
const visibleAreaOffset = (padding: ViewportPadding): L.Point =>
  L.point((padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2);

/**
 * Map center that puts the given point in the middle of the visible part of the map, i.e. the
 * part not covered by overlays such as the bottom sheet or the search field.
 */
export const centerForVisibleArea = (
  map: L.Map,
  point: L.LatLng,
  padding: ViewportPadding
): L.LatLng => {
  const zoom = map.getZoom();
  return map.unproject(map.project(point, zoom).subtract(visibleAreaOffset(padding)), zoom);
};

/** Center of the part of the map not covered by overlays; the inverse of `centerForVisibleArea`. */
export const visibleAreaCenter = (map: L.Map, padding: ViewportPadding): Coordinates => {
  const zoom = map.getZoom();
  const center = map.unproject(
    map.project(map.getCenter(), zoom).add(visibleAreaOffset(padding)),
    zoom
  );
  return { latitude: center.lat, longitude: center.lng };
};

export const isSameViewportPadding = (first: ViewportPadding, second: ViewportPadding): boolean =>
  first.top === second.top &&
  first.right === second.right &&
  first.bottom === second.bottom &&
  first.left === second.left;

/** Square around the search circle, for fitting the map to the search area. */
export const searchAreaBounds = (center: Coordinates, radiusInKilometers: number): L.LatLngBounds =>
  L.latLng(center.latitude, center.longitude).toBounds(
    2 * radiusInKilometers * METERS_PER_KILOMETER
  );

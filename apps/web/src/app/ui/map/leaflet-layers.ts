import { METERS_PER_KILOMETER } from '@genialtanken/contracts';
import type { Coordinates } from '@genialtanken/contracts';
import type { SearchCenter } from '../../core/search-center/search-center';
import { L } from './leaflet';
import { createMarkerElement, ZERO_SIZE } from './marker-elements';

/**
 * Leaflet stacks markers by their position on the screen plus this offset; price tags, even the
 * highest-ranked ones, must never be hidden behind the search center.
 */
const BELOW_PRICE_TAGS_Z_INDEX_OFFSET = -10_000;

const createNamedMarkerIcon = (
  element: HTMLElement,
  accessibleName: string,
  className: string
): L.DivIcon => {
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', accessibleName);
  return L.divIcon({ html: element, className, iconSize: ZERO_SIZE });
};

/** Teardrop pin whose tip marks the search center. */
const createPinIcon = (accessibleName: string): L.DivIcon => {
  const pin = createMarkerElement('div', 'location-pin');
  pin.append(createMarkerElement('span', 'location-pin__head'));
  return createNamedMarkerIcon(pin, accessibleName, 'location-pin-marker');
};

const createOwnPositionIcon = (accessibleName: string): L.DivIcon =>
  createNamedMarkerIcon(
    createMarkerElement('div', 'own-position-dot'),
    accessibleName,
    'own-position-marker'
  );

/**
 * Search center as a pin, the user's own position as a dot, like in Apple Maps. Neither carries a
 * visible label: it would cover the price tags of the closest stations, and the search field
 * already names the place.
 */
export const createCenterMarker = (center: SearchCenter): L.Marker =>
  L.marker([center.latitude, center.longitude], {
    icon:
      center.source === 'own-position'
        ? createOwnPositionIcon(center.label)
        : createPinIcon(center.label),
    interactive: false,
    keyboard: false,
    zIndexOffset: BELOW_PRICE_TAGS_Z_INDEX_OFFSET,
  });

/**
 * Thin outline of the search radius; its bounds are what the map fits into view. `map.scss` sets
 * its stroke width from a token, which overrides Leaflet's `weight` attribute.
 */
export const createRadiusCircle = (center: Coordinates, radiusInKilometers: number): L.Circle =>
  L.circle([center.latitude, center.longitude], {
    radius: radiusInKilometers * METERS_PER_KILOMETER,
    className: 'search-radius',
    interactive: false,
  });

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

/** Teardrop pin whose tip marks the search center. */
const createPinIcon = (): L.DivIcon => {
  const pin = createMarkerElement('div', 'location-pin');
  pin.append(createMarkerElement('span', 'location-pin__head'));
  return L.divIcon({ html: pin, className: 'location-pin-marker', iconSize: ZERO_SIZE });
};

const createOwnPositionIcon = (accessibleName: string): L.DivIcon => {
  const dot = createMarkerElement('div', 'own-position-dot');
  dot.setAttribute('role', 'img');
  dot.setAttribute('aria-label', accessibleName);
  return L.divIcon({ html: dot, className: 'own-position-marker', iconSize: ZERO_SIZE });
};

/**
 * Search center with its label. The user's own position is only a dot, like in Apple Maps: a
 * permanent label next to it would cover the price tags of the closest stations. A center the
 * user moved the map to needs no label: it is where they are looking.
 */
export const createCenterMarker = (center: SearchCenter): L.Marker => {
  const isOwnPosition = center.source === 'own-position';
  const marker = L.marker([center.latitude, center.longitude], {
    icon: isOwnPosition ? createOwnPositionIcon(center.label) : createPinIcon(),
    interactive: false,
    keyboard: false,
    zIndexOffset: BELOW_PRICE_TAGS_Z_INDEX_OFFSET,
  });
  if (isOwnPosition || center.source === 'map-area') {
    return marker;
  }
  const label = createMarkerElement('span', 'center-tooltip__label', center.label);
  return marker.bindTooltip(label, {
    permanent: true,
    direction: 'top',
    // `map.scss` lifts the label above the pin, sized like it in rem.
    className: 'center-tooltip center-tooltip--above-pin',
  });
};

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

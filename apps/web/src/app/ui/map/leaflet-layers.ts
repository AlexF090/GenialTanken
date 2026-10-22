import { METERS_PER_KILOMETER } from '@genialtanken/contracts';
import type { Coordinates } from '@genialtanken/contracts';
import type { SearchCenter } from '../../core/search-center/search-center';
import { L } from './leaflet';
import { createMarkerElement, ZERO_SIZE } from './marker-elements';

/** Greets the user at their own position on the map. */
const OWN_POSITION_GREETING = 'Du bist hier!';

/** Teardrop pin whose tip marks the search center. */
const createPinIcon = (): L.DivIcon => {
  const pin = createMarkerElement('div', 'location-pin');
  pin.append(createMarkerElement('span', 'location-pin__head'));
  return L.divIcon({ html: pin, className: 'location-pin-marker', iconSize: ZERO_SIZE });
};

const createOwnPositionIcon = (): L.DivIcon =>
  L.divIcon({
    html: createMarkerElement('div', 'own-position-dot'),
    className: 'own-position-marker',
    iconSize: ZERO_SIZE,
  });

/**
 * Search center with its label; the user's own position is a dot greeting them instead. A center
 * the user moved the map to needs no label: it is where they are looking.
 */
export const createCenterMarker = (center: SearchCenter): L.Marker => {
  const isOwnPosition = center.source === 'own-position';
  const marker = L.marker([center.latitude, center.longitude], {
    icon: isOwnPosition ? createOwnPositionIcon() : createPinIcon(),
    interactive: false,
    keyboard: false,
  });
  if (center.source === 'map-area') {
    return marker;
  }
  const label = createMarkerElement(
    'span',
    'center-tooltip__label',
    isOwnPosition ? OWN_POSITION_GREETING : center.label
  );
  return marker.bindTooltip(label, {
    permanent: true,
    direction: 'top',
    // `map.scss` lifts the label above the dot or pin, sized like them in rem.
    className: isOwnPosition
      ? 'center-tooltip center-tooltip--above-dot'
      : 'center-tooltip center-tooltip--above-pin',
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

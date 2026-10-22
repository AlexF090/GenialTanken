import { METERS_PER_KILOMETER } from '@genialtanken/contracts';
import type { Coordinates } from '@genialtanken/contracts';
import type { SearchCenter } from '../../core/search-center/search-center';
import { L } from './leaflet';
import { createMarkerElement, ZERO_SIZE } from './marker-elements';
import { createPriceClusterIcon, createPriceTagIcon } from './price-tag-icons';
import type { PriceTagAppearance } from './price-tag-icons';

const SELECTED_Z_INDEX_OFFSET = 2000;
const CHEAPEST_Z_INDEX_OFFSET = 1000;

export interface StationMarkerOptions extends PriceTagAppearance {
  stationIdentifier: string;
  coordinates: Coordinates;
  title: string;
}

const ACTIVATION_KEYS: ReadonlySet<string> = new Set(['Enter', ' ']);

/**
 * Leaflet gives interactive markers `role="button"` and a tab stop, but no key clicks them. Pass
 * this as a Leaflet `keydown` listener so Enter and Space click the marker like a native button.
 * The listener goes through Leaflet's event delegation, not the icon element, because Leaflet
 * recreates icons when clustering or changing the icon. The click propagates like a pointer
 * click, so a cluster group reports it as `clusterclick`.
 */
export const clickOnActivationKey = (event: L.LeafletEvent): void => {
  // Leaflet types cluster events as plain events, although they carry the keyboard event too.
  if (!('originalEvent' in event) || !(event.originalEvent instanceof KeyboardEvent)) {
    return;
  }
  const keyboardEvent = event.originalEvent;
  const marker: unknown = event.sourceTarget;
  if (!ACTIVATION_KEYS.has(keyboardEvent.key) || !(marker instanceof L.Marker)) {
    return;
  }
  keyboardEvent.preventDefault();
  marker.fire('click', { originalEvent: keyboardEvent }, true);
};

/** Keyboard-focusable price tag of one station, clicked with Enter or Space. */
export class StationMarker extends L.Marker {
  readonly stationIdentifier: string;
  private readonly stationTitle: string;
  private currentAppearance: PriceTagAppearance;

  constructor({ stationIdentifier, coordinates, title, ...appearance }: StationMarkerOptions) {
    super([coordinates.latitude, coordinates.longitude], {
      keyboard: true,
      riseOnHover: true,
    });
    this.stationIdentifier = stationIdentifier;
    this.stationTitle = title;
    this.currentAppearance = appearance;
    this.applySelection();
    // Clustering removes and re-adds markers, which creates a new icon element every time.
    this.on('add', () => {
      this.applyPressedState();
    });
    this.on('keydown', clickOnActivationKey);
  }

  get appearance(): PriceTagAppearance {
    return this.currentAppearance;
  }

  setSelected(isSelected: boolean): void {
    if (isSelected === this.currentAppearance.isSelected) {
      return;
    }
    this.currentAppearance = { ...this.currentAppearance, isSelected };
    this.applySelection();
  }

  private applySelection(): void {
    this.setIcon(
      createPriceTagIcon({ accessibleName: this.stationTitle, ...this.currentAppearance })
    );
    this.setZIndexOffset(this.zIndexOffset());
    this.applyPressedState();
  }

  /** The selected tag lies on top of all others, the cheapest on top of the regular ones. */
  private zIndexOffset(): number {
    if (this.currentAppearance.isSelected) {
      return SELECTED_Z_INDEX_OFFSET;
    }
    return this.currentAppearance.isCheapest ? CHEAPEST_Z_INDEX_OFFSET : 0;
  }

  private applyPressedState(): void {
    this.getElement()?.setAttribute('aria-pressed', String(this.currentAppearance.isSelected));
  }
}

type StationCluster = Pick<L.MarkerCluster, 'getChildCount' | 'getAllChildMarkers'>;

/** Icon of a cluster of station price tags. */
export const createClusterIcon = (cluster: StationCluster): L.DivIcon =>
  createPriceClusterIcon(
    cluster
      .getAllChildMarkers()
      .filter(marker => marker instanceof StationMarker)
      .map(marker => marker.appearance),
    cluster.getChildCount()
  );

/** Greets the user at their own position on the map. */
const OWN_POSITION_GREETING = 'Du bist hier!';

/** Teardrop pin whose tip marks the location; used for search centers and station locations. */
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

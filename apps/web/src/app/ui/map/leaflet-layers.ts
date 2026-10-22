import { METERS_PER_KILOMETER } from '@genialtanken/contracts';
import type { Coordinates } from '@genialtanken/contracts';
import type { SearchCenter } from '../../core/search-center/search-center';
import type { PriceLevel } from '../../core/stations/price-level';
import { L } from './leaflet';
import { createMarkerElement, ZERO_SIZE } from './marker-elements';
import { createPriceClusterIcon, createPriceTagIcon } from './price-tag-icons';

const SELECTED_Z_INDEX_OFFSET = 2000;
const CHEAPEST_Z_INDEX_OFFSET = 1000;

export interface StationMarkerOptions {
  stationIdentifier: string;
  coordinates: Coordinates;
  title: string;
  priceInEuro: number | null;
  priceLevel?: PriceLevel;
  isCheapest: boolean;
  isSelected: boolean;
}

/**
 * Keyboard-focusable price tag of one station. Leaflet gives the icon `role="button"` and a tab
 * stop; Enter triggers `click` through Leaflet, Space is added here like on native buttons.
 */
export class StationMarker extends L.Marker {
  readonly stationIdentifier: string;
  readonly stationPriceInEuro: number | null;
  readonly stationPriceLevel: PriceLevel | undefined;
  readonly isCheapestStation: boolean;
  private readonly stationTitle: string;
  private isSelectedStation: boolean;

  constructor(options: StationMarkerOptions) {
    super([options.coordinates.latitude, options.coordinates.longitude], {
      keyboard: true,
      riseOnHover: true,
    });
    this.stationIdentifier = options.stationIdentifier;
    this.stationTitle = options.title;
    this.stationPriceInEuro = options.priceInEuro;
    this.stationPriceLevel = options.priceLevel;
    this.isCheapestStation = options.isCheapest;
    this.isSelectedStation = options.isSelected;
    this.applySelection();
    // Clustering removes and re-adds markers, which creates a new icon element every time.
    this.on('add', () => {
      this.applyPressedState();
      this.getElement()?.addEventListener('keydown', event => {
        this.clickOnSpace(event);
      });
    });
  }

  setSelected(isSelected: boolean): void {
    if (isSelected === this.isSelectedStation) {
      return;
    }
    this.isSelectedStation = isSelected;
    this.applySelection();
  }

  private applySelection(): void {
    this.setIcon(
      createPriceTagIcon({
        accessibleName: this.stationTitle,
        priceInEuro: this.stationPriceInEuro,
        priceLevel: this.stationPriceLevel,
        isCheapest: this.isCheapestStation,
        isSelected: this.isSelectedStation,
      })
    );
    this.setZIndexOffset(this.zIndexOffset());
    this.applyPressedState();
  }

  /** The selected tag lies on top of all others, the cheapest on top of the regular ones. */
  private zIndexOffset(): number {
    if (this.isSelectedStation) {
      return SELECTED_Z_INDEX_OFFSET;
    }
    return this.isCheapestStation ? CHEAPEST_Z_INDEX_OFFSET : 0;
  }

  private applyPressedState(): void {
    this.getElement()?.setAttribute('aria-pressed', String(this.isSelectedStation));
  }

  private clickOnSpace(event: Event): void {
    if (!(event instanceof KeyboardEvent) || event.key !== ' ') {
      return;
    }
    event.preventDefault();
    this.fire('click');
  }
}

type StationCluster = Pick<L.MarkerCluster, 'getChildCount' | 'getAllChildMarkers'>;

/** Icon of a cluster of station price tags. */
export const createClusterIcon = (cluster: StationCluster): L.DivIcon =>
  createPriceClusterIcon(
    cluster.getAllChildMarkers().filter(marker => marker instanceof StationMarker),
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

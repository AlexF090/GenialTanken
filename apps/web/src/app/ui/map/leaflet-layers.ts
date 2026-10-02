// Leaflet has to be imported before the marker cluster plugin, which extends the global `L`.
import L from 'leaflet';
import 'leaflet.markercluster';
import { formatPrice, formatPriceParts } from '../../core/formatting/number-format';
import type { Coordinates } from '../../core/geolocation/coordinates';
import type { SearchCenter } from '../../core/search-center/search-center';
import type { ResolvedColorScheme } from '../../core/theme/color-scheme-controller';

const MAPBOX_STYLES: Readonly<Record<ResolvedColorScheme, string>> = {
  light: 'alexf090/cl2uhl8gx008p14qop192uczn',
  dark: 'mapbox/dark-v11',
};
const MAPBOX_ATTRIBUTION =
  '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const OPEN_STREET_MAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OPEN_STREET_MAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende';
export const MAXIMUM_ZOOM = 19;
const METERS_PER_KILOMETER = 1000;

const mapboxTileUrl = (style: string, accessToken: string): string =>
  `https://api.mapbox.com/styles/v1/${style}/tiles/256/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(accessToken)}`;

/**
 * Mapbox style matching the color scheme when a token is configured, OpenStreetMap otherwise.
 * OpenStreetMap has no dark style; `map.scss` darkens its tiles with a filter instead.
 */
export const createTileLayer = (
  mapboxAccessToken: string,
  colorScheme: ResolvedColorScheme
): L.TileLayer =>
  mapboxAccessToken === ''
    ? L.tileLayer(OPEN_STREET_MAP_TILE_URL, {
        attribution: OPEN_STREET_MAP_ATTRIBUTION,
        maxZoom: MAXIMUM_ZOOM,
        className: 'open-street-map-tiles',
      })
    : L.tileLayer(mapboxTileUrl(MAPBOX_STYLES[colorScheme], mapboxAccessToken), {
        attribution: MAPBOX_ATTRIBUTION,
        maxZoom: MAXIMUM_ZOOM,
      });

// Marker content is built from DOM nodes with `textContent`: station names and place labels come
// from external sources and must never be parsed as HTML.
const createElement = (
  tagName: 'div' | 'span' | 'sup',
  className: string,
  text?: string
): HTMLElement => {
  const element = document.createElement(tagName);
  element.className = className;
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
};

const createAccessibleName = (name: string): HTMLElement =>
  createElement('span', 'visually-hidden', name);

/** "1,85⁹" for the eyes; screen readers get the accessible name instead. */
const createPriceDigits = (className: string, priceInEuro: number | null): HTMLElement => {
  const digits = createElement('span', className);
  digits.setAttribute('aria-hidden', 'true');
  if (priceInEuro === null) {
    digits.textContent = '–';
    return digits;
  }
  const { leadingDigits, tenthOfCent } = formatPriceParts(priceInEuro);
  digits.append(leadingDigits, createElement('sup', '', tenthOfCent));
  return digits;
};

/** Visible word for the cheapest price, so it is not told by the yellow alone (WCAG 1.4.1). */
const CHEAPEST_CAPTION = 'günstigst';

/** Screen readers hear "günstigster Preis" in the accessible name instead. */
const createCheapestCaption = (className: string): HTMLElement => {
  const caption = createElement('span', className, CHEAPEST_CAPTION);
  caption.setAttribute('aria-hidden', 'true');
  return caption;
};

/** Pins are drawn by their inner element in `map.scss` around the zero-sized icon. */
const ZERO_SIZE: L.PointTuple = [0, 0];
/**
 * Interactive markers keep their content size (a zero-sized button would have no hit box and
 * count as invisible); `map.scss` moves them onto their point with the CSS `translate` property.
 */
const CONTENT_SIZE = undefined;

export interface PriceTagIconOptions {
  /** Usually the station title; price and highlight are appended. */
  accessibleName: string;
  priceInEuro: number | null;
  isCheapest: boolean;
  isSelected: boolean;
}

export const priceTagAccessibleName = ({
  accessibleName,
  priceInEuro,
  isCheapest,
}: PriceTagIconOptions): string => {
  if (priceInEuro === null) {
    return `${accessibleName}, kein Preis`;
  }
  const name = `${accessibleName}, ${formatPrice(priceInEuro)}`;
  return isCheapest ? `${name}, günstigster Preis` : name;
};

/** A small price board with a pointer to the station's location. */
export const createPriceTagIcon = (options: PriceTagIconOptions): L.DivIcon => {
  const tag = createElement('div', 'price-tag');
  tag.classList.toggle('price-tag--cheapest', options.isCheapest);
  tag.classList.toggle('price-tag--selected', options.isSelected);
  tag.classList.toggle('price-tag--without-price', options.priceInEuro === null);
  tag.append(
    createAccessibleName(priceTagAccessibleName(options)),
    createPriceDigits('price-tag__price', options.priceInEuro)
  );
  if (options.isCheapest) {
    tag.append(createCheapestCaption('price-tag__caption'));
  }
  return L.divIcon({ html: tag, className: 'price-tag-marker', iconSize: CONTENT_SIZE });
};

const SELECTED_Z_INDEX_OFFSET = 2000;
const CHEAPEST_Z_INDEX_OFFSET = 1000;

export interface StationMarkerOptions {
  stationId: string;
  coordinates: Coordinates;
  title: string;
  priceInEuro: number | null;
  isCheapest: boolean;
  isSelected: boolean;
}

/**
 * Keyboard-focusable price tag of one station. Leaflet gives the icon `role="button"` and a tab
 * stop; Enter triggers `click` through Leaflet, Space is added here like on native buttons.
 */
export class StationMarker extends L.Marker {
  readonly stationId: string;
  readonly stationPriceInEuro: number | null;
  readonly isCheapestStation: boolean;
  private readonly stationTitle: string;
  private isSelectedStation: boolean;

  constructor(options: StationMarkerOptions) {
    super([options.coordinates.latitude, options.coordinates.longitude], {
      keyboard: true,
      riseOnHover: true,
    });
    this.stationId = options.stationId;
    this.stationTitle = options.title;
    this.stationPriceInEuro = options.priceInEuro;
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

export type StationCluster = Pick<L.MarkerCluster, 'getChildCount' | 'getAllChildMarkers'>;

/** Number of stations and the lowest price among them, highlighted if it is the cheapest. */
export const createClusterIcon = (cluster: StationCluster): L.DivIcon => {
  const stations = cluster.getAllChildMarkers().filter(marker => marker instanceof StationMarker);
  const prices = stations.flatMap(station =>
    station.stationPriceInEuro === null ? [] : [station.stationPriceInEuro]
  );
  const minimumPrice = prices.length === 0 ? null : Math.min(...prices);
  const stationCount = cluster.getChildCount();
  const accessibleName =
    minimumPrice === null
      ? `${String(stationCount)} Tankstellen, kein Preis`
      : `${String(stationCount)} Tankstellen, ab ${formatPrice(minimumPrice)}`;

  const containsCheapest = stations.some(station => station.isCheapestStation);

  const board = createElement('div', 'price-cluster');
  board.classList.toggle('price-cluster--cheapest', containsCheapest);
  const count = createElement('span', 'price-cluster__count', String(stationCount));
  count.setAttribute('aria-hidden', 'true');
  const lowestPrice = createElement('span', 'price-cluster__lowest-price');
  lowestPrice.setAttribute('aria-hidden', 'true');
  lowestPrice.append(
    createElement('span', 'price-cluster__from', 'ab'),
    createPriceDigits('price-cluster__price', minimumPrice)
  );
  if (containsCheapest) {
    lowestPrice.append(createElement('span', 'price-cluster__caption', CHEAPEST_CAPTION));
  }
  board.append(createAccessibleName(accessibleName), count, lowestPrice);
  return L.divIcon({ html: board, className: 'price-cluster-marker', iconSize: CONTENT_SIZE });
};

export const OWN_POSITION_LABEL = 'Du bist hier!';

/** Teardrop pin whose tip marks the location; used for search centers and station locations. */
const createPinIcon = (): L.DivIcon => {
  const pin = createElement('div', 'location-pin');
  pin.append(createElement('span', 'location-pin__head'));
  return L.divIcon({ html: pin, className: 'location-pin-marker', iconSize: ZERO_SIZE });
};

const createOwnPositionIcon = (): L.DivIcon =>
  L.divIcon({
    html: createElement('div', 'own-position-dot'),
    className: 'own-position-marker',
    iconSize: ZERO_SIZE,
  });

/** Non-interactive pin for a single location, e.g. the station on the detail page. */
export const createLocationPin = (coordinates: Coordinates): L.Marker =>
  L.marker([coordinates.latitude, coordinates.longitude], {
    icon: createPinIcon(),
    interactive: false,
    keyboard: false,
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
  const label = createElement(
    'span',
    'center-tooltip__label',
    isOwnPosition ? OWN_POSITION_LABEL : center.label
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

export { L };

/**
 * Removes a map even while a pan or zoom animation is still running; a plain `remove()` lets
 * pending animation frames access the already removed panes (`_leaflet_pos` of undefined).
 */
export const destroyMap = (map: L.Map): void => {
  map.stop();
  map.off();
  map.remove();
};

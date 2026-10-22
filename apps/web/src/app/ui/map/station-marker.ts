import type { Coordinates } from '@genialtanken/contracts';
import { L } from './leaflet';
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

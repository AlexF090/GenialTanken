import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import type { FuelType, Station } from '@genialtanken/contracts';
import { formatPrice, formatPriceParts } from '../../core/formatting/number-format';
import type { Coordinates } from '../../core/geolocation/geolocation-service';
import { priceInEuro, stationTitle } from '../../core/stations/station-display';
import {
  createOwnPositionMarker,
  createStationMarker,
  createTileLayer,
  destroyMap,
  L,
} from '../map/leaflet-layers';
import {
  FALLBACK_MAP_CENTER,
  FALLBACK_MAP_ZOOM,
  MAPBOX_ACCESS_TOKEN,
  OWN_POSITION_ZOOM,
} from '../map/map-configuration';

const isPlainLeftClick = (event: MouseEvent): boolean =>
  event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;

/** Interactive map with clustered station markers and the user's own position. */
@Component({
  selector: 'app-stations-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div
    #map
    class="stations-map"
    role="region"
    aria-label="Karte der Tankstellen in deiner Nähe"></div>`,
  styles: `
    :host {
      position: relative;
      display: block;
    }

    /* Absolute positioning gives Leaflet the size the flex layout assigned to the host. */
    .stations-map {
      position: absolute;
      inset: 0;
    }
  `,
})
export class StationsMap {
  readonly stations = input.required<readonly Station[]>();
  readonly fuelType = input.required<FuelType>();
  readonly ownPosition = input<Coordinates>();
  /** Emitted with the station id when "Mehr Anzeigen" in a marker popup is clicked. */
  readonly stationSelected = output<string>();

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly mapboxAccessToken = inject(MAPBOX_ACCESS_TOKEN);
  private readonly map = signal<L.Map | undefined>(undefined);
  private readonly markerClusterGroup = L.markerClusterGroup();

  constructor() {
    afterNextRender(() => {
      const map = L.map(this.container().nativeElement, { zoomControl: false }).setView(
        [FALLBACK_MAP_CENTER.latitude, FALLBACK_MAP_CENTER.longitude],
        FALLBACK_MAP_ZOOM
      );
      L.control
        .zoom({ position: 'topright', zoomInTitle: 'Hineinzoomen', zoomOutTitle: 'Herauszoomen' })
        .addTo(map);
      createTileLayer(this.mapboxAccessToken).addTo(map);
      this.markerClusterGroup.addTo(map);
      this.map.set(map);
    });

    effect(() => {
      if (this.map() === undefined) {
        return;
      }
      const fuelType = this.fuelType();
      const markers = this.stations().map(station => this.createMarker(station, fuelType));
      this.markerClusterGroup.clearLayers();
      this.markerClusterGroup.addLayers(markers);
    });

    effect(onCleanup => {
      const map = this.map();
      const ownPosition = this.ownPosition();
      if (map === undefined || ownPosition === undefined) {
        return;
      }
      untracked(() => {
        map.setView([ownPosition.latitude, ownPosition.longitude], OWN_POSITION_ZOOM, {
          animate: false,
        });
      });
      const marker = createOwnPositionMarker(ownPosition).addTo(map);
      onCleanup(() => marker.remove());
    });

    inject(DestroyRef).onDestroy(() => {
      const map = this.map();
      if (map !== undefined) {
        destroyMap(map);
      }
    });
  }

  private createMarker(station: Station, fuelType: FuelType): L.Marker {
    const title = stationTitle(station);
    const price = priceInEuro(station, fuelType);
    const accessibleName = price === null ? title : `${title}, ${formatPrice(price)}`;
    return createStationMarker(station.address, accessibleName, { interactive: true }).bindPopup(
      () => this.createPopupContent(station.id, title, price),
      { className: 'station-marker-popup' }
    );
  }

  private createPopupContent(stationId: string, title: string, price: number | null): HTMLElement {
    const content = document.createElement('div');

    const heading = document.createElement('strong');
    heading.textContent = title;

    const priceParagraph = document.createElement('p');
    priceParagraph.className = 'station-marker-popup__price';
    if (price === null) {
      priceParagraph.textContent = 'Kein Preis';
    } else {
      const { leadingDigits, tenthOfCent } = formatPriceParts(price);
      const tenthOfCentElement = document.createElement('sup');
      tenthOfCentElement.textContent = tenthOfCent;
      priceParagraph.append(leadingDigits, tenthOfCentElement, ' €');
    }

    const link = document.createElement('a');
    link.className = 'station-marker-popup__link';
    link.href = `/stations/${encodeURIComponent(stationId)}`;
    link.textContent = 'Mehr Anzeigen';
    link.addEventListener('click', event => {
      if (!isPlainLeftClick(event)) {
        return;
      }
      event.preventDefault();
      this.stationSelected.emit(stationId);
    });

    content.append(heading, priceParagraph, link);
    return content;
  }
}

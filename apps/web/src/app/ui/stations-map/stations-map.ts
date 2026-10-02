import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  createComponent,
  DestroyRef,
  effect,
  EnvironmentInjector,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import type { FuelType, Station } from '@genialtanken/contracts';
import { formatPrice } from '../../core/formatting/number-format';
import type { Coordinates } from '../../core/geolocation/coordinates';
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
import { Price } from '../price/price';

interface PopupPrice {
  element: HTMLElement;
  destroy: () => void;
}

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
  private readonly environmentInjector = inject(EnvironmentInjector);
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
    const marker = createStationMarker(station.address, accessibleName, { interactive: true });
    // Leaflet builds the content on every opening, so each opening gets its own price component.
    let destroyPrice = (): void => undefined;
    marker.on('popupclose', () => {
      destroyPrice();
    });
    return marker.bindPopup(
      () => {
        const priceParagraph = this.createPopupPrice(price);
        destroyPrice = priceParagraph.destroy;
        return this.createPopupContent(station.id, title, priceParagraph.element);
      },
      { className: 'station-marker-popup' }
    );
  }

  /** Renders the shared `app-price` so the popup cannot drift from the list's price format. */
  private createPopupPrice(price: number | null): PopupPrice {
    const priceParagraph = document.createElement('p');
    priceParagraph.className = 'station-marker-popup__price';
    if (price === null) {
      priceParagraph.textContent = 'Kein Preis';
      return { element: priceParagraph, destroy: () => undefined };
    }
    const priceHost = document.createElement('app-price');
    const priceComponent = createComponent(Price, {
      environmentInjector: this.environmentInjector,
      hostElement: priceHost,
    });
    priceComponent.setInput('priceInEuro', price);
    priceComponent.changeDetectorRef.detectChanges();
    priceParagraph.append(priceHost);
    return {
      element: priceParagraph,
      destroy: () => {
        priceComponent.destroy();
      },
    };
  }

  private createPopupContent(
    stationId: string,
    title: string,
    priceParagraph: HTMLElement
  ): HTMLElement {
    const content = document.createElement('div');

    const heading = document.createElement('strong');
    heading.textContent = title;

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

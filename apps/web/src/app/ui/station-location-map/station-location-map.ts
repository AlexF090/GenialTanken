import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import type { Station } from '@genialtanken/contracts';
import { createStationMarker, createTileLayer, destroyMap, L } from '../map/leaflet-layers';
import { MAPBOX_ACCESS_TOKEN, STATION_LOCATION_ZOOM } from '../map/map-configuration';

/** Small static map showing where a single station is. */
@Component({
  selector: 'app-station-location-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div
    #map
    class="station-location-map"
    role="region"
    [attr.aria-label]="'Karte: Lage von ' + stationTitle()"></div>`,
  styles: `
    .station-location-map {
      height: var(--layout-detail-map-height);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-map);
      overflow: hidden;
    }
  `,
})
export class StationLocationMap {
  readonly station = input.required<Station>();
  readonly stationTitle = input.required<string>();

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly mapboxAccessToken = inject(MAPBOX_ACCESS_TOKEN);
  private readonly map = signal<L.Map | undefined>(undefined);

  constructor() {
    afterNextRender(() => {
      const map = L.map(this.container().nativeElement, {
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        scrollWheelZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomControl: false,
      });
      createTileLayer(this.mapboxAccessToken).addTo(map);
      this.map.set(map);
    });

    effect(onCleanup => {
      const map = this.map();
      if (map === undefined) {
        return;
      }
      const { latitude, longitude } = this.station().address;
      map.setView([latitude, longitude], STATION_LOCATION_ZOOM, { animate: false });
      const marker = createStationMarker({ latitude, longitude }, this.stationTitle(), {
        interactive: false,
      }).addTo(map);
      onCleanup(() => marker.remove());
    });

    inject(DestroyRef).onDestroy(() => {
      const map = this.map();
      if (map !== undefined) {
        destroyMap(map);
      }
    });
  }
}

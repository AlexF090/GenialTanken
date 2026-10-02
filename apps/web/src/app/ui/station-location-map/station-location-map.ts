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
import type { ResolvedColorScheme } from '../../core/theme/color-scheme-controller';
import {
  createLocationPin,
  createTileLayer,
  destroyMap,
  L,
  MAXIMUM_ZOOM,
} from '../map/leaflet-layers';
import { MAPBOX_ACCESS_TOKEN, STATION_LOCATION_ZOOM } from '../map/map-configuration';

/** Small static map with a pin where a single station is. */
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
      border: var(--border-width-hairline) solid var(--color-hairline);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
  `,
})
export class StationLocationMap {
  readonly station = input.required<Station>();
  readonly stationTitle = input.required<string>();
  readonly colorScheme = input<ResolvedColorScheme>('light');

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
        maxZoom: MAXIMUM_ZOOM,
      });
      this.map.set(map);
    });

    effect(onCleanup => {
      const map = this.map();
      if (map === undefined) {
        return;
      }
      const tileLayer = createTileLayer(this.mapboxAccessToken, this.colorScheme()).addTo(map);
      onCleanup(() => tileLayer.remove());
    });

    effect(onCleanup => {
      const map = this.map();
      if (map === undefined) {
        return;
      }
      const { latitude, longitude } = this.station().address;
      map.setView([latitude, longitude], STATION_LOCATION_ZOOM, { animate: false });
      const pin = createLocationPin({ latitude, longitude }).addTo(map);
      onCleanup(() => pin.remove());
    });

    inject(DestroyRef).onDestroy(() => {
      const map = this.map();
      if (map !== undefined) {
        destroyMap(map);
      }
    });
  }
}

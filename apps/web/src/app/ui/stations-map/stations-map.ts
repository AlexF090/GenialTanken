import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { Coordinates, FuelType, Station } from '@genialtanken/contracts';
import { observeElementResize } from '../../core/layout/observe-element-resize';
import { injectPrefersReducedMotion } from '../../core/layout/reduced-motion';
import { CONFIGURED_MAPBOX_ACCESS_TOKEN } from '../../core/map/mapbox-access-token';
import type { SearchCenter } from '../../core/search-center/search-center';
import type { ResolvedColorScheme } from '../../core/theme/color-scheme-controller';
import { L } from '../map/leaflet';
import { createCenterMarker, createRadiusCircle } from '../map/leaflet-layers';
import type { StationMarker } from '../map/leaflet-layers';
import { destroyMap } from '../map/map-teardown';
import {
  centerForVisibleArea,
  EDGE_SPACING_IN_PIXELS,
  hasVisibleArea,
  isSameViewportPadding,
  NO_VIEWPORT_PADDING,
  searchAreaBounds,
  toPaddingOptions,
  visibleAreaCenter,
} from '../map/map-viewport';
import type { ViewportPadding } from '../map/map-viewport';
import { revealMarker } from '../map/reveal-marker';
import type { MarkerReveal } from '../map/reveal-marker';
import { createTileLayer, MAXIMUM_ZOOM } from '../map/tile-layer';
import { StationMarkerLayer } from './station-marker-layer';

/** A price tag stands above its map point; fitting points alone would cut off the top tags. */
const PRICE_TAG_HEIGHT_IN_PIXELS = 40;
/** Leaflet's default is unbounded, so a fast swipe flings the map far and for long. */
const INERTIA_MAXIMUM_SPEED_IN_PIXELS_PER_SECOND = 1500;

/**
 * Interactive map of the search area: a price tag per station (clustered when close), the search
 * center and the search radius. Selecting a tag reports the station; a selection from outside
 * brings its tag into view.
 */
@Component({
  selector: 'app-stations-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div
    #map
    class="stations-map"
    role="region"
    aria-label="Karte der Tankstellen"></div>`,
  styles: `
    :host {
      position: relative;
      display: block;
    }

    /* Absolute positioning gives Leaflet the size the layout assigned to the host. */
    .stations-map {
      position: absolute;
      inset: 0;
    }
  `,
})
export class StationsMap {
  readonly stations = input.required<readonly Station[]>();
  readonly fuelType = input.required<FuelType>();
  readonly center = input.required<SearchCenter>();
  readonly radiusInKilometers = input.required<number>();
  readonly selectedStationIdentifier = input<string>();
  readonly cheapestStationIdentifiers = input<ReadonlySet<string>>(new Set());
  readonly colorScheme = input<ResolvedColorScheme>('light');
  readonly viewportPadding = input<ViewportPadding>(NO_VIEWPORT_PADDING);
  /** Emitted with the station id when a price tag is clicked or activated with the keyboard. */
  readonly stationSelected = output<string>();
  /** Center of the visible map after the user moved it, e.g. to offer a search there. */
  readonly visibleCenterChanged = output<Coordinates>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly mapboxAccessToken = inject(CONFIGURED_MAPBOX_ACCESS_TOKEN);
  private readonly prefersReducedMotion = injectPrefersReducedMotion();
  private readonly map = signal<L.Map | undefined>(undefined);
  private readonly stationMarkers = new StationMarkerLayer(marker => {
    this.selectFromMap(marker);
  });
  private revealedStationIdentifier: string | undefined;
  private markerReveal: MarkerReveal | undefined;
  /** Set once the user drags the map; overlay changes then no longer move the view. */
  private hasUserMovedMap = false;
  /** A selected station stays centered while overlays move, until the user moves the map. */
  private hasUserMovedMapSinceReveal = false;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      // The cluster group needs a maximum zoom before the first tile layer is added.
      const map = L.map(this.container().nativeElement, {
        zoomControl: false,
        maxZoom: MAXIMUM_ZOOM,
        inertiaMaxSpeed: INERTIA_MAXIMUM_SPEED_IN_PIXELS_PER_SECOND,
      });
      this.fitSearchArea(map, { animate: false });
      L.control
        .zoom({ position: 'topright', zoomInTitle: 'Hineinzoomen', zoomOutTitle: 'Herauszoomen' })
        .addTo(map);
      const clusterGroup = this.stationMarkers.clusterGroup;
      clusterGroup.addTo(map);
      clusterGroup.on('clusterclick', event => {
        const cluster: unknown = event.propagatedFrom;
        if (cluster instanceof L.MarkerCluster) {
          this.zoomIntoCluster(map, cluster);
        }
      });
      map.on('dragstart', () => {
        this.hasUserMovedMap = true;
        this.hasUserMovedMapSinceReveal = true;
      });
      map.on('moveend', () => {
        if (this.hasUserMovedMap) {
          this.visibleCenterChanged.emit(visibleAreaCenter(map, this.viewportPadding()));
        }
      });
      observeElementResize(
        [this.host.nativeElement],
        () => {
          map.invalidateSize();
        },
        destroyRef
      );
      this.map.set(map);
    });

    // The first fit happens before overlays such as the bottom sheet report their size.
    let previousViewportPadding: ViewportPadding | undefined;
    effect(() => {
      const map = this.map();
      const viewportPadding = this.viewportPadding();
      if (map === undefined) {
        return;
      }
      const hasPaddingChanged =
        previousViewportPadding !== undefined &&
        !isSameViewportPadding(previousViewportPadding, viewportPadding);
      previousViewportPadding = viewportPadding;
      // Nothing to show behind overlays covering the whole map; the next change fits again.
      if (!hasPaddingChanged || !hasVisibleArea(map, viewportPadding)) {
        return;
      }
      untracked(() => {
        const selectedStationIdentifier = this.selectedStationIdentifier();
        if (selectedStationIdentifier !== undefined) {
          // E.g. the sheet moved after a price tag was chosen: keep that station in the middle.
          const selectedMarker = this.stationMarkers
            .markersByStationIdentifier()
            .get(selectedStationIdentifier);
          if (selectedMarker !== undefined && !this.hasUserMovedMapSinceReveal) {
            this.reveal(map, selectedMarker);
          }
          return;
        }
        if (!this.hasUserMovedMap) {
          this.fitSearchArea(map, this.motion());
        }
      });
    });

    effect(onCleanup => {
      const map = this.map();
      if (map === undefined) {
        return;
      }
      const tileLayer = createTileLayer(this.mapboxAccessToken, this.colorScheme()).addTo(map);
      onCleanup(() => tileLayer.remove());
    });

    let previousRadiusInKilometers: number | undefined;
    effect(onCleanup => {
      const map = this.map();
      if (map === undefined) {
        return;
      }
      const center = this.center();
      const radiusInKilometers = this.radiusInKilometers();
      const circle = createRadiusCircle(center, radiusInKilometers).addTo(map);
      const centerMarker = createCenterMarker(center).addTo(map);
      onCleanup(() => {
        circle.remove();
        centerMarker.remove();
      });
      // A new search area is a fresh start, even after the user moved the map.
      this.hasUserMovedMap = false;
      const hasRadiusChanged = radiusInKilometers !== previousRadiusInKilometers;
      previousRadiusInKilometers = radiusInKilometers;
      // The user is already looking at an area they moved the map to; fitting would jump.
      if (center.source === 'map-area' && !hasRadiusChanged) {
        return;
      }
      untracked(() => {
        this.fitSearchArea(map, this.motion());
      });
    });

    effect(() => {
      if (this.map() === undefined) {
        return;
      }
      const stations = this.stations();
      const context = {
        fuelType: this.fuelType(),
        cheapestStationIdentifiers: this.cheapestStationIdentifiers(),
        selectedStationIdentifier: untracked(() => this.selectedStationIdentifier()),
      };
      // A reveal still in progress targets a replaced marker; reveal the new one instead.
      if (this.markerReveal?.isPending === true) {
        this.markerReveal.cancel();
        this.revealedStationIdentifier = undefined;
      }
      this.stationMarkers.showStations(stations, context);
    });

    effect(() => {
      const map = this.map();
      const selectedStationIdentifier = this.selectedStationIdentifier();
      const markers = this.stationMarkers.markersByStationIdentifier();
      if (map === undefined) {
        return;
      }
      this.stationMarkers.select(selectedStationIdentifier);
      if (selectedStationIdentifier === undefined) {
        this.markerReveal?.cancel();
        this.revealedStationIdentifier = undefined;
        return;
      }
      // Revealed once per selection, not again whenever the markers are rebuilt.
      const selectedMarker = markers.get(selectedStationIdentifier);
      if (
        selectedMarker === undefined ||
        selectedStationIdentifier === this.revealedStationIdentifier
      ) {
        return;
      }
      this.revealedStationIdentifier = selectedStationIdentifier;
      untracked(() => {
        this.reveal(map, selectedMarker);
      });
    });

    destroyRef.onDestroy(() => {
      this.markerReveal?.cancel();
      const map = this.map();
      if (map !== undefined) {
        // Stopping a running animation fires `moveend`; the output is already gone then.
        map.off('moveend');
        destroyMap(map);
      }
    });
  }

  /** Centers the selected station again, e.g. when its row in the list is chosen once more. */
  revealSelectedStation(): void {
    const map = this.map();
    const selectedStationIdentifier = this.selectedStationIdentifier();
    const marker =
      selectedStationIdentifier === undefined
        ? undefined
        : this.stationMarkers.markersByStationIdentifier().get(selectedStationIdentifier);
    if (map !== undefined && marker !== undefined) {
      this.reveal(map, marker);
    }
  }

  private selectFromMap(marker: StationMarker): void {
    // A selection does not change when its price tag is clicked again, so center it here.
    const map = this.map();
    if (map !== undefined && this.selectedStationIdentifier() === marker.stationIdentifier) {
      this.reveal(map, marker);
    }
    this.stationSelected.emit(marker.stationIdentifier);
  }

  /** Animates map moves unless the user prefers reduced motion. */
  private motion(): { animate: boolean } {
    return { animate: !this.prefersReducedMotion() };
  }

  /** Fits the search radius into the part of the map not covered by overlays. */
  private fitSearchArea(map: L.Map, motion: { animate: boolean }): void {
    map.fitBounds(searchAreaBounds(this.center(), this.radiusInKilometers()), {
      ...toPaddingOptions(this.viewportPadding()),
      ...motion,
    });
  }

  /**
   * Zooms so the cluster's stations fill the part of the map not covered by overlays. When
   * zooming cannot separate them (maximum zoom), they fan out around the centered cluster.
   */
  private zoomIntoCluster(map: L.Map, cluster: L.MarkerCluster): void {
    const viewportPadding = this.viewportPadding();
    const paddingForTags = {
      ...viewportPadding,
      top: viewportPadding.top + PRICE_TAG_HEIGHT_IN_PIXELS,
    };
    const bounds = cluster.getBounds();
    const totalPadding = L.point(
      viewportPadding.left + viewportPadding.right + 2 * EDGE_SPACING_IN_PIXELS,
      paddingForTags.top + paddingForTags.bottom + 2 * EDGE_SPACING_IN_PIXELS
    );
    const targetZoom = Math.min(map.getBoundsZoom(bounds, false, totalPadding), map.getMaxZoom());
    if (targetZoom <= map.getZoom()) {
      cluster.spiderfy();
      map.panTo(centerForVisibleArea(map, cluster.getLatLng(), viewportPadding), this.motion());
      return;
    }
    map.fitBounds(bounds, {
      ...toPaddingOptions(paddingForTags),
      maxZoom: map.getMaxZoom(),
      ...this.motion(),
    });
  }

  /**
   * Opens the marker's cluster if needed, then centers the marker in the visible part of the map,
   * like a tapped pin in Apple Maps.
   */
  private reveal(map: L.Map, marker: StationMarker): void {
    this.markerReveal?.cancel();
    this.hasUserMovedMapSinceReveal = false;
    this.markerReveal = revealMarker(map, this.stationMarkers.clusterGroup, marker, () => {
      map.panTo(
        centerForVisibleArea(map, marker.getLatLng(), this.viewportPadding()),
        this.motion()
      );
    });
  }
}

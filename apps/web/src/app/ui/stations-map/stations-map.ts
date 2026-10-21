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
import type { FuelType, Station } from '@genialtanken/contracts';
import { injectMediaQueryMatches } from '../../core/layout/media-query';
import type { Coordinates } from '../../core/geolocation/coordinates';
import type { SearchCenter } from '../../core/search-center/search-center';
import { priceLevelOf, priceRangeOf } from '../../core/stations/price-level';
import type { PriceRange } from '../../core/stations/price-level';
import { priceInEuro, stationTitle } from '../../core/stations/station-display';
import type { ResolvedColorScheme } from '../../core/theme/color-scheme-controller';
import {
  createCenterMarker,
  createClusterIcon,
  createRadiusCircle,
  createTileLayer,
  destroyMap,
  L,
  MAXIMUM_ZOOM,
  StationMarker,
} from '../map/leaflet-layers';
import { MAPBOX_ACCESS_TOKEN } from '../map/map-configuration';
import {
  centerForVisibleArea,
  EDGE_SPACING_IN_PIXELS,
  isSameViewportPadding,
  NO_VIEWPORT_PADDING,
  searchAreaBounds,
  toPaddingOptions,
  visibleAreaCenter,
} from '../map/map-viewport';
import type { ViewportPadding } from '../map/map-viewport';
import { revealMarker } from '../map/reveal-marker';
import type { MarkerReveal } from '../map/reveal-marker';

/** What every price tag of one rendering shares. */
interface MarkerContext {
  fuelType: FuelType;
  priceRange: PriceRange | undefined;
  cheapestStationIdentifiers: ReadonlySet<string>;
  selectedStationIdentifier: string | undefined;
}

/** A price tag stands above its map point; fitting points alone would cut off the top tags. */
const PRICE_TAG_HEIGHT_IN_PIXELS = 40;
const CLUSTER_RADIUS_IN_PIXELS = 56;

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
  private readonly mapboxAccessToken = inject(MAPBOX_ACCESS_TOKEN);
  private readonly prefersReducedMotion = injectMediaQueryMatches(
    '(prefers-reduced-motion: reduce)'
  );
  private readonly map = signal<L.Map | undefined>(undefined);
  private readonly markersByStationIdentifier = signal<ReadonlyMap<string, StationMarker>>(
    new Map()
  );
  private readonly markerClusterGroup = L.markerClusterGroup({
    iconCreateFunction: createClusterIcon,
    showCoverageOnHover: false,
    maxClusterRadius: CLUSTER_RADIUS_IN_PIXELS,
    // The default zoom ignores the overlays; `zoomIntoCluster` fits into the visible part and
    // decides alone when to fan out.
    zoomToBoundsOnClick: false,
    spiderfyOnMaxZoom: false,
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
      });
      map.fitBounds(searchAreaBounds(this.center(), this.radiusInKilometers()), {
        ...toPaddingOptions(this.viewportPadding()),
        animate: false,
      });
      L.control
        .zoom({ position: 'topright', zoomInTitle: 'Hineinzoomen', zoomOutTitle: 'Herauszoomen' })
        .addTo(map);
      this.markerClusterGroup.addTo(map);
      this.markerClusterGroup.on('clusterclick', event => {
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
      this.observeHostSize(map, destroyRef);
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
      if (!hasPaddingChanged) {
        return;
      }
      const selectedStationIdentifier = untracked(() => this.selectedStationIdentifier());
      if (selectedStationIdentifier !== undefined) {
        // E.g. the sheet moved after a price tag was chosen: keep that station in the middle.
        const selectedMarker = untracked(() => this.markersByStationIdentifier()).get(
          selectedStationIdentifier
        );
        if (selectedMarker !== undefined && !this.hasUserMovedMapSinceReveal) {
          untracked(() => {
            this.reveal(map, selectedMarker);
          });
        }
        return;
      }
      if (this.hasUserMovedMap) {
        return;
      }
      untracked(() => {
        map.fitBounds(searchAreaBounds(this.center(), this.radiusInKilometers()), {
          ...toPaddingOptions(viewportPadding),
          animate: !this.prefersReducedMotion(),
        });
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
        map.fitBounds(searchAreaBounds(center, radiusInKilometers), {
          ...toPaddingOptions(this.viewportPadding()),
          animate: !this.prefersReducedMotion(),
        });
      });
    });

    effect(() => {
      if (this.map() === undefined) {
        return;
      }
      const fuelType = this.fuelType();
      const cheapestStationIdentifiers = this.cheapestStationIdentifiers();
      const selectedStationIdentifier = untracked(() => this.selectedStationIdentifier());
      const stations = this.stations();
      const priceRange = priceRangeOf(stations.map(station => priceInEuro(station, fuelType)));
      const markers = new Map(
        stations.map(station => [
          station.id,
          this.createMarker(station, {
            fuelType,
            priceRange,
            cheapestStationIdentifiers,
            selectedStationIdentifier,
          }),
        ])
      );
      // A reveal still in progress targets a replaced marker; reveal the new one instead.
      if (this.markerReveal?.isPending === true) {
        this.markerReveal.cancel();
        this.revealedStationIdentifier = undefined;
      }
      this.markerClusterGroup.clearLayers();
      this.markerClusterGroup.addLayers([...markers.values()]);
      this.markersByStationIdentifier.set(markers);
    });

    effect(() => {
      const map = this.map();
      const selectedStationIdentifier = this.selectedStationIdentifier();
      const markers = this.markersByStationIdentifier();
      if (map === undefined) {
        return;
      }
      for (const [stationIdentifier, marker] of markers) {
        marker.setSelected(stationIdentifier === selectedStationIdentifier);
      }
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

  private createMarker(station: Station, context: MarkerContext): StationMarker {
    const price = priceInEuro(station, context.fuelType);
    const marker = new StationMarker({
      stationIdentifier: station.id,
      coordinates: station.address,
      title: stationTitle(station),
      priceInEuro: price,
      priceLevel:
        price === null || context.priceRange === undefined
          ? undefined
          : priceLevelOf(price, context.priceRange),
      isCheapest: context.cheapestStationIdentifiers.has(station.id),
      isSelected: station.id === context.selectedStationIdentifier,
    });
    marker.on('click', () => {
      // A selection does not change when its price tag is clicked again, so center it here.
      const map = this.map();
      if (map !== undefined && this.selectedStationIdentifier() === station.id) {
        this.reveal(map, marker);
      }
      this.stationSelected.emit(station.id);
    });
    return marker;
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
    const paddingOptions = toPaddingOptions(paddingForTags);
    const animate = !this.prefersReducedMotion();
    const bounds = cluster.getBounds();
    const totalPadding = L.point(
      viewportPadding.left + viewportPadding.right + 2 * EDGE_SPACING_IN_PIXELS,
      paddingForTags.top + paddingForTags.bottom + 2 * EDGE_SPACING_IN_PIXELS
    );
    const targetZoom = Math.min(map.getBoundsZoom(bounds, false, totalPadding), map.getMaxZoom());
    if (targetZoom <= map.getZoom()) {
      cluster.spiderfy();
      map.panTo(centerForVisibleArea(map, cluster.getLatLng(), viewportPadding), { animate });
      return;
    }
    map.fitBounds(bounds, { ...paddingOptions, maxZoom: map.getMaxZoom(), animate });
  }

  /** Centers the selected station again, e.g. when its row in the list is chosen once more. */
  revealSelectedStation(): void {
    const map = this.map();
    const selectedStationIdentifier = this.selectedStationIdentifier();
    const marker =
      selectedStationIdentifier === undefined
        ? undefined
        : this.markersByStationIdentifier().get(selectedStationIdentifier);
    if (map !== undefined && marker !== undefined) {
      this.reveal(map, marker);
    }
  }

  /**
   * Opens the marker's cluster if needed, then centers the marker in the visible part of the map,
   * like a tapped pin in Apple Maps.
   */
  private reveal(map: L.Map, marker: StationMarker): void {
    this.markerReveal?.cancel();
    this.hasUserMovedMapSinceReveal = false;
    this.markerReveal = revealMarker(map, this.markerClusterGroup, marker, () => {
      map.panTo(centerForVisibleArea(map, marker.getLatLng(), this.viewportPadding()), {
        animate: !this.prefersReducedMotion(),
      });
    });
  }

  private observeHostSize(map: L.Map, destroyRef: DestroyRef): void {
    // jsdom (unit tests) has no ResizeObserver; the map keeps its initial size there.
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(this.host.nativeElement);
    destroyRef.onDestroy(() => {
      observer.disconnect();
    });
  }
}

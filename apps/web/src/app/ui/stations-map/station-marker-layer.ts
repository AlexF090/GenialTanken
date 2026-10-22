import { signal } from '@angular/core';
import type { FuelType, Station } from '@genialtanken/contracts';
import { priceLevelOf, priceRangeOf } from '../../core/stations/price-level';
import { priceInEuro, stationTitle } from '../../core/stations/station-display';
import { L } from '../map/leaflet';
import { centerForVisibleArea, toPaddingOptions, totalPaddingOf } from '../map/map-viewport';
import type { ViewportPadding } from '../map/map-viewport';
import { clickOnActivationKey, createClusterIcon, StationMarker } from '../map/station-marker';
import { revealMarker } from '../map/reveal-marker';
import type { MarkerReveal } from '../map/reveal-marker';
import type { PriceTagAppearance } from '../map/price-tag-icons';

const CLUSTER_RADIUS_IN_PIXELS = 56;
/** A price tag stands above its map point; fitting points alone would cut off the top tags. */
const PRICE_TAG_HEIGHT_IN_PIXELS = 40;

/** A cluster icon was activated, by pointer or keyboard. */
export interface ClusterActivation {
  cluster: L.MarkerCluster;
  isFromKeyboard: boolean;
}

/** Opening a cluster that has not finished yet. */
export interface ClusterOpening {
  /** Stops waiting for the cluster to open; `onOpened` is not called anymore. */
  cancel(): void;
}

/** Stations without a price come last. */
const isCheaper = (candidate: PriceTagAppearance, current: PriceTagAppearance): boolean =>
  candidate.priceInEuro !== null &&
  (current.priceInEuro === null || candidate.priceInEuro < current.priceInEuro);

/** What the price tags of one rendering share. */
export interface StationMarkerContext {
  fuelType: FuelType;
  cheapestStationIdentifiers: ReadonlySet<string>;
  selectedStationIdentifier: string | undefined;
}

/**
 * The price tags of the shown stations, clustered when close. Rebuilt whenever stations, fuel or
 * the cheapest stations change; selection only updates the existing tags.
 */
export class StationMarkerLayer {
  private readonly clusterGroup = L.markerClusterGroup({
    iconCreateFunction: createClusterIcon,
    showCoverageOnHover: false,
    maxClusterRadius: CLUSTER_RADIUS_IN_PIXELS,
    // The default zoom ignores the overlays; the map fits clusters into its visible part and
    // decides alone when to fan out.
    zoomToBoundsOnClick: false,
    spiderfyOnMaxZoom: false,
  });
  private readonly markers = signal<ReadonlyMap<string, StationMarker>>(new Map());
  private spiderfiedCluster: L.MarkerCluster | undefined;

  /** `onClick` is called with the station's marker when its price tag is activated. */
  constructor(private readonly onClick: (marker: StationMarker) => void) {
    this.clusterGroup.on('spiderfied', event => {
      this.spiderfiedCluster = event.cluster;
    });
    this.clusterGroup.on('unspiderfied', () => {
      this.spiderfiedCluster = undefined;
    });
  }

  /** `onClusterClick` is called with the cluster whose icon is activated. */
  addTo(map: L.Map, onClusterClick: (activation: ClusterActivation) => void): void {
    this.clusterGroup.addTo(map);
    this.clusterGroup.on('clusterclick', event => {
      const cluster: unknown = event.propagatedFrom;
      if (cluster instanceof L.MarkerCluster) {
        onClusterClick({
          cluster,
          // Leaflet types cluster events as plain events, although they carry the original one.
          isFromKeyboard: 'originalEvent' in event && event.originalEvent instanceof KeyboardEvent,
        });
      }
    });
    this.clusterGroup.on('clusterkeydown', clickOnActivationKey);
  }

  /**
   * Zooms so the cluster's stations fill the part of the map not covered by overlays. When zooming
   * cannot separate them (maximum zoom), they fan out around the centered cluster. Calls
   * `onOpened` once the group shows them, right away for a cluster fanned out already.
   */
  openCluster(
    map: L.Map,
    cluster: L.MarkerCluster,
    padding: ViewportPadding,
    motion: L.ZoomPanOptions,
    onOpened: () => void
  ): ClusterOpening {
    const paddingForTags = { ...padding, top: padding.top + PRICE_TAG_HEIGHT_IN_PIXELS };
    const bounds = cluster.getBounds();
    const targetZoom = Math.min(
      map.getBoundsZoom(bounds, false, totalPaddingOf(paddingForTags)),
      map.getMaxZoom()
    );
    if (targetZoom <= map.getZoom()) {
      return this.fanOut(map, cluster, padding, motion, onOpened);
    }
    // The group signals with `animationend` that its clusters match the new zoom level.
    this.clusterGroup.once('animationend', onOpened);
    map.fitBounds(bounds, {
      ...toPaddingOptions(paddingForTags),
      maxZoom: map.getMaxZoom(),
      ...motion,
    });
    return {
      cancel: () => {
        this.clusterGroup.off('animationend', onOpened);
      },
    };
  }

  private fanOut(
    map: L.Map,
    cluster: L.MarkerCluster,
    padding: ViewportPadding,
    motion: L.ZoomPanOptions,
    onOpened: () => void
  ): ClusterOpening {
    const centerCluster = (): void => {
      map.panTo(centerForVisibleArea(map, cluster.getLatLng(), padding), motion);
    };
    // `spiderfy` does nothing for a cluster fanned out already, so no event would come.
    if (this.spiderfiedCluster === cluster) {
      centerCluster();
      onOpened();
      return { cancel: () => undefined };
    }
    const onSpiderfied = (event: L.MarkerClusterSpiderfyEvent): void => {
      if (event.cluster === cluster) {
        stopWaiting();
        onOpened();
      }
    };
    const stopWaiting = (): void => {
      this.clusterGroup.off('spiderfied', onSpiderfied);
      map.off('zoomstart', stopWaiting);
    };
    this.clusterGroup.on('spiderfied', onSpiderfied);
    // `spiderfy` also does nothing during a zoom animation, and a zoom replaces the cluster.
    map.on('zoomstart', stopWaiting);
    cluster.spiderfy();
    centerCluster();
    return { cancel: stopWaiting };
  }

  /**
   * Element now showing the cheapest station of an opened cluster: its price tag or a smaller
   * cluster. The cluster announced that price, so it is what the user expects to find. Of equally
   * cheap stations the first one shown wins (the API sorts by distance): the cluster's own order
   * depends on how it was built.
   */
  elementShowingCheapestOf(cluster: L.MarkerCluster): HTMLElement | undefined {
    const markersOfCluster = new Set(cluster.getAllChildMarkers());
    const cheapestMarker = [...this.markers().values()]
      .filter(marker => markersOfCluster.has(marker))
      .reduce<StationMarker | undefined>(
        (cheapest, marker) =>
          cheapest === undefined || isCheaper(marker.appearance, cheapest.appearance)
            ? marker
            : cheapest,
        undefined
      );
    if (cheapestMarker === undefined) {
      return undefined;
    }
    // Typed as never null, but it is null while neither the marker nor a cluster of it is shown.
    const visibleParent: unknown = this.clusterGroup.getVisibleParent(cheapestMarker);
    return visibleParent instanceof L.Marker ? visibleParent.getElement() : undefined;
  }

  /** Reads a signal, so effects calling it run again when the markers are rebuilt. */
  markerOf(stationIdentifier: string): StationMarker | undefined {
    return this.markers().get(stationIdentifier);
  }

  /** Opens the marker's clusters as needed, see `revealMarker`. */
  reveal(map: L.Map, marker: StationMarker, onShown: () => void): MarkerReveal {
    return revealMarker(map, this.clusterGroup, marker, onShown);
  }

  showStations(stations: readonly Station[], context: StationMarkerContext): void {
    const priceRange = priceRangeOf(
      stations.map(station => priceInEuro(station, context.fuelType))
    );
    const markers = new Map(
      stations.map((station): [string, StationMarker] => {
        const price = priceInEuro(station, context.fuelType);
        const marker = new StationMarker({
          stationIdentifier: station.id,
          coordinates: station.address,
          title: stationTitle(station),
          priceInEuro: price,
          priceLevel:
            price === null || priceRange === undefined
              ? undefined
              : priceLevelOf(price, priceRange),
          isCheapest: context.cheapestStationIdentifiers.has(station.id),
          isSelected: station.id === context.selectedStationIdentifier,
        });
        marker.on('click', () => {
          this.onClick(marker);
        });
        return [station.id, marker];
      })
    );
    this.clusterGroup.clearLayers();
    this.clusterGroup.addLayers([...markers.values()]);
    this.markers.set(markers);
  }

  select(selectedStationIdentifier: string | undefined): void {
    for (const [stationIdentifier, marker] of this.markers()) {
      marker.setSelected(stationIdentifier === selectedStationIdentifier);
    }
  }
}

import { signal } from '@angular/core';
import type { FuelType, Station } from '@genialtanken/contracts';
import { priceLevelOf, priceRangeOf } from '../../core/stations/price-level';
import { priceInEuro, stationTitle } from '../../core/stations/station-display';
import { L } from '../map/leaflet';
import { createClusterIcon, StationMarker } from '../map/leaflet-layers';

const CLUSTER_RADIUS_IN_PIXELS = 56;

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
  readonly clusterGroup = L.markerClusterGroup({
    iconCreateFunction: createClusterIcon,
    showCoverageOnHover: false,
    maxClusterRadius: CLUSTER_RADIUS_IN_PIXELS,
    // The default zoom ignores the overlays; the map fits clusters into its visible part and
    // decides alone when to fan out.
    zoomToBoundsOnClick: false,
    spiderfyOnMaxZoom: false,
  });
  private readonly markers = signal<ReadonlyMap<string, StationMarker>>(new Map());
  readonly markersByStationIdentifier = this.markers.asReadonly();

  /** `onClick` is called with the station's marker when its price tag is activated. */
  constructor(private readonly onClick: (marker: StationMarker) => void) {}

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

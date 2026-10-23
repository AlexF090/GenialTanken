import { inject, Injectable } from '@angular/core';
import type { Station } from '@genialtanken/contracts';
import { FavoriteStationsResource } from '../favorites/favorite-stations-resource';
import { NearbyStationsStore } from './nearby-stations-store';
import { OpenedStationStore } from './opened-station-store';

/**
 * Stations the app has loaded already: the search results, the starred stations and the station
 * whose card is open. A card for one of them shows at once instead of asking the API again, which
 * can take a minute while the free API host wakes up.
 */
@Injectable({ providedIn: 'root' })
export class KnownStations {
  private readonly nearbyStations = inject(NearbyStationsStore).stations;
  private readonly favoriteStations = inject(FavoriteStationsResource).stations;
  private readonly openedStation = inject(OpenedStationStore).station;

  /** Reads signals, so a computed calling it updates when the stations change. */
  find(stationIdentifier: string): Station | undefined {
    const isWanted = (station: Station | undefined): station is Station =>
      station?.id === stationIdentifier;
    return (
      this.nearbyStations().find(isWanted) ??
      this.favoriteStations().find(isWanted) ??
      (isWanted(this.openedStation()) ? this.openedStation() : undefined)
    );
  }
}

import { computed, inject, Injectable, linkedSignal, resource } from '@angular/core';
import type { Station } from '@genialtanken/contracts';
import { reloadWhenReconnected } from '../network/network-status';
import { StationsApi } from '../stations/stations-api';
import type { StationsByIdentifiers } from '../stations/stations-api';
import { FavoritesStore } from './favorites-store';

const containsAll = (loaded: readonly string[], requested: readonly string[]): boolean =>
  requested.every(stationIdentifier => loaded.includes(stationIdentifier));

/**
 * The starred stations with their current prices, shared by the favorites in the explore sheet
 * and the favorites list, so both show the same data from one request
 * (`StationsApi.loadStationsByIdentifiers`, in chunks of 50).
 *
 * Unstarring only hides a station, so lists update immediately without a request; starring one
 * that is not loaded yet loads them again, and the previous stations stay shown meanwhile.
 * Favorites are never removed automatically: a 404 can be temporary, e.g. for a station the
 * French price service does not list at the moment.
 */
@Injectable({ providedIn: 'root' })
export class FavoriteStationsResource {
  private readonly favorites = inject(FavoritesStore);
  private readonly stationsApi = inject(StationsApi);

  /** Stays the same while favorites are only removed: the loaded stations still cover them. */
  private readonly stationIdentifiersToLoad = computed(
    () => this.favorites.favoriteStationIdentifiers(),
    { equal: containsAll }
  );
  private readonly resource = resource({
    params: () => {
      const stationIdentifiers = this.stationIdentifiersToLoad();
      return stationIdentifiers.length === 0 ? undefined : stationIdentifiers;
    },
    loader: ({ params }) => this.stationsApi.loadStationsByIdentifiers(params),
  });

  /** The last loaded answer; kept while newly starred stations load. Undefined after an error. */
  readonly loaded = linkedSignal<
    StationsByIdentifiers | undefined,
    StationsByIdentifiers | undefined
  >({
    source: () => (this.resource.hasValue() ? this.resource.value() : undefined),
    computation: (value, previous) =>
      value ?? (this.resource.isLoading() ? previous?.value : undefined),
  });
  readonly isLoading = this.resource.isLoading;
  readonly error = this.resource.error;

  /** Loaded favorites that are still starred, in the order they were starred. */
  readonly stations = computed<readonly Station[]>(() => {
    const loadedStations = new Map(
      (this.loaded()?.stations ?? []).map(station => [station.id, station])
    );
    return this.favorites
      .favoriteStationIdentifiers()
      .map(stationIdentifier => loadedStations.get(stationIdentifier))
      .filter(station => station !== undefined);
  });
  /** Still starred favorites the API does not know right now. */
  readonly unavailableStationIdentifiers = computed<readonly string[]>(() => {
    const favoriteStationIdentifiers = this.favorites.favoriteStationIdentifierSet();
    return (this.loaded()?.unavailableStationIdentifiers ?? []).filter(stationIdentifier =>
      favoriteStationIdentifiers.has(stationIdentifier)
    );
  });

  constructor() {
    reloadWhenReconnected(this.resource);
  }

  /**
   * Fetches current prices for stations already shown, e.g. when the favorites list opens. A
   * first load still on its way is not requested twice.
   */
  refreshIfLoaded(): void {
    if (this.resource.hasValue()) {
      this.resource.reload();
    }
  }
}

import { computed, inject, Injectable, resource, signal, untracked } from '@angular/core';
import type { Station } from '@genialtanken/contracts';
import { reloadWhenReconnected } from '../network/network-status';
import { StationsApi } from '../stations/stations-api';
import type { StationsByIdentifiers } from '../stations/stations-api';
import { CURRENT_DATE } from '../time/current-date';
import { FavoritesStore } from './favorites-store';

interface StationsRequest {
  readonly stationIdentifiers: readonly string[];
  /** Counts refreshes, so a refresh asks again even when the favorites did not change. */
  readonly refresh: number;
}

/** Unstarring keeps the request: the loaded stations still cover the remaining favorites. */
const coversRequest = (loaded: StationsRequest, requested: StationsRequest): boolean =>
  loaded.refresh === requested.refresh &&
  requested.stationIdentifiers.every(stationIdentifier =>
    loaded.stationIdentifiers.includes(stationIdentifier)
  );

interface LoadedFavorites {
  readonly answer: StationsByIdentifiers;
  /** When the oldest of the stations arrived. */
  readonly loadedAt: Date;
}

/**
 * Stations whose lookup failed keep their last loaded prices instead of vanishing, and with them
 * the older load time, so none of the stations counts as fresher than it is.
 */
const withStationsOfFailedLookupsKept = (
  answer: StationsByIdentifiers,
  answeredAt: Date,
  previous: LoadedFavorites | undefined
): LoadedFavorites => {
  if (previous === undefined || answer.failures.length === 0) {
    return { answer, loadedAt: answeredAt };
  }
  const failedStationIdentifiers = new Set(
    answer.failures.map(failure => failure.stationIdentifier)
  );
  const keptStations = previous.answer.stations.filter(station =>
    failedStationIdentifiers.has(station.id)
  );
  if (keptStations.length === 0) {
    return { answer, loadedAt: answeredAt };
  }
  return {
    answer: { ...answer, stations: [...answer.stations, ...keptStations] },
    loadedAt: previous.loadedAt,
  };
};

/**
 * The starred stations with their current prices, shared by the favorites in the explore sheet
 * and the favorites list, so both show the same data from one request
 * (`StationsApi.loadStationsByIdentifiers`, in chunks of 50).
 *
 * Unstarring only hides a station, so lists update immediately without a request; starring one
 * that is not loaded yet loads them again, and the previous stations stay shown meanwhile. A
 * refresh asks only for the stations still starred. Stations that fail to load keep their last
 * prices; `loaded().failures` and `error` report the failure next to them.
 * Favorites are never removed automatically: a 404 can be temporary, e.g. for a station the
 * French price service does not list at the moment.
 */
@Injectable({ providedIn: 'root' })
export class FavoriteStationsResource {
  private readonly favorites = inject(FavoritesStore);
  private readonly stationsApi = inject(StationsApi);
  private readonly currentDate = inject(CURRENT_DATE);

  private readonly refreshCount = signal(0);
  private readonly request = computed<StationsRequest>(
    () => ({
      stationIdentifiers: this.favorites.favoriteStationIdentifiers(),
      refresh: this.refreshCount(),
    }),
    { equal: coversRequest }
  );
  /** Written by the loader, so it survives the loading and error states of the resource. */
  private readonly lastLoaded = signal<LoadedFavorites | undefined>(undefined);
  private readonly resource = resource({
    params: () => {
      const { stationIdentifiers } = this.request();
      return stationIdentifiers.length === 0 ? undefined : [...stationIdentifiers];
    },
    loader: async ({ params, abortSignal }) => {
      const answer = await this.stationsApi.loadStationsByIdentifiers(params);
      if (abortSignal.aborted) {
        return answer;
      }
      const loaded = withStationsOfFailedLookupsKept(
        answer,
        untracked(this.currentDate),
        this.lastLoaded()
      );
      this.lastLoaded.set(loaded);
      return loaded.answer;
    },
  });

  /**
   * The last loaded answer; kept while newly starred stations load and after an error, and
   * stations of failed lookups keep their previous prices. Undefined without favorites.
   */
  readonly loaded = computed(() =>
    this.resource.status() === 'idle' ? undefined : this.lastLoaded()?.answer
  );
  /** When the oldest of the loaded stations arrived; undefined without favorites. */
  readonly loadedAt = computed(() =>
    this.resource.status() === 'idle' ? undefined : this.lastLoaded()?.loadedAt
  );
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
    reloadWhenReconnected({
      isLoading: this.resource.isLoading,
      // Failed chunks do not fail the resource, so they count as an error for the retry.
      error: computed(() => this.resource.error() ?? this.loaded()?.failures[0]?.error),
      reload: () => {
        this.refresh();
      },
    });
  }

  /**
   * Fetches current prices for stations already shown, e.g. when the favorites list opens. A
   * first load still on its way is not requested twice.
   */
  refreshIfLoaded(): void {
    if (this.resource.hasValue()) {
      this.refresh();
    }
  }

  private refresh(): void {
    this.refreshCount.update(count => count + 1);
  }
}

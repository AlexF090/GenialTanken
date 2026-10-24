import { computed, inject, Injectable, InjectionToken } from '@angular/core';
import type { Signal } from '@angular/core';
import { MILLISECONDS_PER_MINUTE } from '@genialtanken/contracts';
import type { Station } from '@genialtanken/contracts';
import { FavoriteStationsResource } from '../favorites/favorite-stations-resource';
import { NearbyStationsStore } from './nearby-stations-store';
import { OpenedStationStore } from './opened-station-store';

/** Stations the app holds already, with the time they arrived from the API. */
export interface KnownStationSource {
  readonly stations: Signal<readonly Station[]>;
  /** `undefined` while the source holds no stations. */
  readonly loadedAt: Signal<Date | undefined>;
}

/** A known station and the time its source loaded it. */
export interface KnownStation {
  readonly station: Station;
  readonly loadedAt: Date | undefined;
}

/** As long as the API caches its answers; older prices may have changed by now. */
export const KNOWN_STATION_MAXIMUM_AGE_IN_MILLISECONDS = 5 * MILLISECONDS_PER_MINUTE;

/**
 * Whether the API probably has fresher prices than the known ones, e.g. in a PWA resumed after
 * hours. Data without load time cannot be dated and counts as current.
 */
export const isOutdated = (knownStation: KnownStation, now: Date): boolean =>
  knownStation.loadedAt !== undefined &&
  now.getTime() - knownStation.loadedAt.getTime() > KNOWN_STATION_MAXIMUM_AGE_IN_MILLISECONDS;

/**
 * The search results, the starred stations and the station whose card is open, in this order of
 * preference.
 */
export const KNOWN_STATION_SOURCES = new InjectionToken<readonly KnownStationSource[]>(
  'KnownStationSources',
  {
    providedIn: 'root',
    factory: () => {
      const nearbyStations = inject(NearbyStationsStore);
      const favoriteStations = inject(FavoriteStationsResource);
      const openedStation = inject(OpenedStationStore);
      return [
        { stations: nearbyStations.stations, loadedAt: nearbyStations.loadedAt },
        { stations: favoriteStations.stations, loadedAt: favoriteStations.loadedAt },
        {
          stations: computed(() => {
            const station = openedStation.station();
            return station === undefined ? [] : [station];
          }),
          loadedAt: openedStation.loadedAt,
        },
      ];
    },
  }
);

/**
 * Stations the app has loaded already. A card for one of them shows at once instead of asking the
 * API again, which can take a minute while the free API host wakes up.
 */
@Injectable({ providedIn: 'root' })
export class KnownStations {
  private readonly sources = inject(KNOWN_STATION_SOURCES);

  /** Reads signals, so a computed calling it updates when the stations change. */
  find(stationIdentifier: string): KnownStation | undefined {
    for (const source of this.sources) {
      const station = source.stations().find(candidate => candidate.id === stationIdentifier);
      if (station !== undefined) {
        return { station, loadedAt: source.loadedAt() };
      }
    }
    return undefined;
  }
}

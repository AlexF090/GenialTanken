import { computed, inject, Injectable } from '@angular/core';
import { isSamePosition } from '../geolocation/coordinates';
import { NetworkStatus, reloadWhenReconnected } from '../network/network-status';
import { SearchCenterStore } from '../search-center/search-center-store';
import { SettingsStore } from '../settings/settings-store';
import { cheapestStationIdentifiers } from './cheapest-station-identifiers';
import { describeStationsError } from './stations-error-message';
import { StationsApi } from './stations-api';
import type { StationsSearch } from './stations-api';
import { resourceValueOr } from '../resource-value-or';
import { injectLoadedAt } from '../time/loaded-at';

const isSameSearch = (first: StationsSearch, second: StationsSearch): boolean =>
  isSamePosition(first, second) &&
  first.radiusInKilometers === second.radiusInKilometers &&
  first.fuelType === second.fuelType;

/**
 * Stations around the search center for the chosen fuel type and radius, loaded as soon as the
 * store is first used. Shared by all views so switching between them does not refetch. A change
 * of center coordinates, fuel type or radius triggers a new request; a new center label alone
 * does not.
 */
@Injectable({ providedIn: 'root' })
export class NearbyStationsStore {
  private readonly searchCenter = inject(SearchCenterStore);
  private readonly settings = inject(SettingsStore);
  private readonly isOnline = inject(NetworkStatus).isOnline;

  private readonly search = computed<StationsSearch>(
    () => {
      const center = this.searchCenter.center();
      return {
        latitude: center.latitude,
        longitude: center.longitude,
        radiusInKilometers: this.settings.radiusInKilometers(),
        fuelType: this.settings.fuelType(),
      };
    },
    { equal: isSameSearch }
  );
  private readonly stationsResource = inject(StationsApi).stationsAround(this.search);

  constructor() {
    reloadWhenReconnected(this.stationsResource);
  }

  readonly stations = computed(() => resourceValueOr(this.stationsResource, []));
  /** When the shown stations arrived, to tell whether their prices are outdated. */
  readonly loadedAt = injectLoadedAt(this.stationsResource);
  readonly hasLoaded = computed(() => this.stationsResource.hasValue());
  readonly isLoading = computed(
    () => this.stationsResource.isLoading() || this.searchCenter.isLocating()
  );
  /** Failures of the stations request; location errors are in `SearchCenterStore`. */
  readonly errorMessage = computed(() => {
    const error = this.stationsResource.error();
    return error === undefined
      ? undefined
      : describeStationsError(error, { isOnline: this.isOnline() });
  });
  readonly cheapestStationIdentifiers = computed(() =>
    cheapestStationIdentifiers(this.stations(), this.settings.fuelType())
  );

  /** Fetches fresh prices for the current search. */
  refresh(): void {
    this.stationsResource.reload();
  }
}

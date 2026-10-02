import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { FavoritesStore } from '../../core/favorites/favorites-store';
import { FUEL_TYPE_LABELS } from '../../core/fuel-type-labels';
import { SettingsStore } from '../../core/settings/settings-store';
import { describeStationsError } from '../../core/stations/stations-error-message';
import { StationsApi } from '../../core/stations/stations-api';
import { LoadingState } from '../../ui/loading-state/loading-state';
import { PageHeader } from '../../ui/page-header/page-header';
import { StationList } from '../../ui/station-list/station-list';

@Component({
  selector: 'app-favorites-page',
  imports: [PageHeader, StationList, LoadingState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './favorites-page.html',
})
export class FavoritesPage {
  private readonly favorites = inject(FavoritesStore);
  private readonly stationsApi = inject(StationsApi);

  protected readonly fuelType = inject(SettingsStore).fuelType;
  protected readonly fuelLabel = computed(() => FUEL_TYPE_LABELS[this.fuelType()].short);
  protected readonly favoriteStationIds = this.favorites.favoriteStationIdSet;
  protected readonly hasFavorites = computed(() => this.favoriteStationIds().size > 0);

  /**
   * Loaded once per visit for the favorites present on arrival. Unstarring only hides a
   * station (see `stations`), so the list updates immediately without refetching.
   * Ids the API no longer knows are removed from the favorites.
   */
  private readonly favoriteStationsResource = resource({
    loader: async () => {
      const result = await this.stationsApi.loadStationsByIds(this.favorites.favoriteStationIds());
      this.favorites.remove(result.unknownStationIds);
      return result;
    },
  });

  protected readonly stations = computed(() => {
    if (!this.favoriteStationsResource.hasValue()) {
      return [];
    }
    const favoriteStationIds = this.favoriteStationIds();
    return this.favoriteStationsResource
      .value()
      .stations.filter(station => favoriteStationIds.has(station.id));
  });
  protected readonly removedStationCount = computed(() =>
    this.favoriteStationsResource.hasValue()
      ? this.favoriteStationsResource.value().unknownStationIds.length
      : 0
  );
  protected readonly isLoading = this.favoriteStationsResource.isLoading;
  protected readonly errorMessage = computed(() => {
    const error = this.favoriteStationsResource.error();
    return error === undefined ? undefined : describeStationsError(error);
  });

  protected toggleFavorite(stationId: string): void {
    this.favorites.toggle(stationId);
  }
}

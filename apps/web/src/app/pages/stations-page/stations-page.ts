import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FavoritesStore } from '../../core/favorites/favorites-store';
import { FUEL_TYPE_LABELS } from '../../core/fuel-type-labels';
import { GeolocationService } from '../../core/geolocation/geolocation-service';
import { SettingsStore } from '../../core/settings/settings-store';
import { cheapestStationIds } from '../../core/stations/cheapest-station-ids';
import { NearbyStationsStore } from '../../core/stations/nearby-stations-store';
import { sortStations } from '../../core/stations/sort-stations';
import type { SortOrder } from '../../core/stations/sort-stations';
import { Icon } from '../../ui/icon/icon';
import { LoadingState } from '../../ui/loading-state/loading-state';
import { PageHeader } from '../../ui/page-header/page-header';
import { SortOrderControl } from '../../ui/sort-order-control/sort-order-control';
import { StationList } from '../../ui/station-list/station-list';

@Component({
  selector: 'app-stations-page',
  imports: [PageHeader, StationList, SortOrderControl, LoadingState, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stations-page.html',
  styleUrl: './stations-page.scss',
})
export class StationsPage {
  private readonly nearbyStations = inject(NearbyStationsStore);
  private readonly settings = inject(SettingsStore);
  private readonly favorites = inject(FavoritesStore);

  protected readonly fuelType = this.settings.fuelType;
  protected readonly fuelLabel = computed(() => FUEL_TYPE_LABELS[this.fuelType()].short);
  protected readonly radiusInKilometers = this.settings.radiusInKilometers;
  protected readonly favoriteStationIds = this.favorites.favoriteStationIdSet;
  protected readonly geolocationErrorMessage = inject(GeolocationService).errorMessage;
  protected readonly stationsErrorMessage = this.nearbyStations.errorMessage;
  protected readonly isLoading = this.nearbyStations.isLoading;
  protected readonly hasLoaded = this.nearbyStations.hasLoaded;

  protected readonly sortOrder = signal<SortOrder>('distance');
  protected readonly stations = computed(() =>
    sortStations(this.nearbyStations.stations(), this.sortOrder(), this.fuelType())
  );
  protected readonly cheapestStationIds = computed(() =>
    cheapestStationIds(this.nearbyStations.stations(), this.fuelType())
  );

  protected refresh(): void {
    this.nearbyStations.refresh();
  }

  protected toggleFavorite(stationId: string): void {
    this.favorites.toggle(stationId);
  }
}

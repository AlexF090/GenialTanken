import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { Station } from '@genialtanken/contracts';
import { FavoritesStore } from '../../core/favorites/favorites-store';
import { FUEL_TYPE_LABELS } from '../../core/fuel-type-labels';
import { GeolocationService } from '../../core/geolocation/geolocation-service';
import { SettingsStore } from '../../core/settings/settings-store';
import { NearbyStationsStore } from '../../core/stations/nearby-stations-store';
import { priceInEuro } from '../../core/stations/station-display';
import { Icon } from '../../ui/icon/icon';
import { LoadingState } from '../../ui/loading-state/loading-state';
import { PageHeader } from '../../ui/page-header/page-header';
import { StationList } from '../../ui/station-list/station-list';

type SortOrder = 'distance' | 'price';

const SORT_ORDER_LABELS: Record<SortOrder, string> = { distance: 'km', price: 'Preis' };

@Component({
  selector: 'app-stations-page',
  imports: [PageHeader, StationList, LoadingState, Icon],
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
  protected readonly sortOrderLabel = computed(() => SORT_ORDER_LABELS[this.sortOrder()]);
  protected readonly stations = computed<readonly Station[]>(() => {
    const stations = this.nearbyStations.stations();
    if (this.sortOrder() === 'distance') {
      return stations;
    }
    const fuelType = this.fuelType();
    return [...stations].sort(
      (first, second) =>
        (priceInEuro(first, fuelType) ?? Number.POSITIVE_INFINITY) -
        (priceInEuro(second, fuelType) ?? Number.POSITIVE_INFINITY)
    );
  });

  constructor() {
    this.nearbyStations.ensureLoaded();
  }

  protected refresh(): void {
    this.nearbyStations.refresh();
  }

  protected toggleSortOrder(): void {
    this.sortOrder.update(sortOrder => (sortOrder === 'distance' ? 'price' : 'distance'));
  }

  protected toggleFavorite(stationId: string): void {
    this.favorites.toggle(stationId);
  }
}

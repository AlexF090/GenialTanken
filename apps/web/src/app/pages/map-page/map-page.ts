import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FUEL_TYPE_LABELS } from '../../core/fuel-type-labels';
import { SearchCenterStore } from '../../core/search-center/search-center-store';
import { SettingsStore } from '../../core/settings/settings-store';
import { NearbyStationsStore } from '../../core/stations/nearby-stations-store';
import { ColorSchemeController } from '../../core/theme/color-scheme-controller';
import { LoadingState } from '../../ui/loading-state/loading-state';
import { PageHeader } from '../../ui/page-header/page-header';
import { StationsMap } from '../../ui/stations-map/stations-map';

@Component({
  selector: 'app-map-page',
  imports: [PageHeader, StationsMap, LoadingState, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map-page.html',
  styleUrl: './map-page.scss',
})
export class MapPage {
  private readonly nearbyStations = inject(NearbyStationsStore);
  private readonly searchCenter = inject(SearchCenterStore);
  private readonly settings = inject(SettingsStore);
  private readonly router = inject(Router);

  protected readonly fuelType = this.settings.fuelType;
  protected readonly radiusInKilometers = this.settings.radiusInKilometers;
  protected readonly fuelLabel = computed(() => FUEL_TYPE_LABELS[this.fuelType()].short);
  protected readonly stations = this.nearbyStations.stations;
  protected readonly cheapestStationIds = this.nearbyStations.cheapestStationIds;
  protected readonly isLoading = this.nearbyStations.isLoading;
  protected readonly stationsErrorMessage = this.nearbyStations.errorMessage;
  protected readonly center = this.searchCenter.center;
  protected readonly locationErrorMessage = this.searchCenter.locationErrorMessage;
  protected readonly colorScheme = inject(ColorSchemeController).resolvedScheme;

  protected showStation(stationId: string): void {
    void this.router.navigate(['/stations', stationId]);
  }
}

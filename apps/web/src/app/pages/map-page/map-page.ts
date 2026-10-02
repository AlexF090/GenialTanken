import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FUEL_TYPE_LABELS } from '../../core/fuel-type-labels';
import { GeolocationService } from '../../core/geolocation/geolocation-service';
import { SettingsStore } from '../../core/settings/settings-store';
import { NearbyStationsStore } from '../../core/stations/nearby-stations-store';
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
  private readonly geolocation = inject(GeolocationService);
  private readonly router = inject(Router);

  protected readonly fuelType = inject(SettingsStore).fuelType;
  protected readonly fuelLabel = computed(() => FUEL_TYPE_LABELS[this.fuelType()].short);
  protected readonly stations = this.nearbyStations.stations;
  protected readonly isLoading = this.nearbyStations.isLoading;
  protected readonly stationsErrorMessage = this.nearbyStations.errorMessage;
  protected readonly ownPosition = this.geolocation.position;
  protected readonly geolocationErrorMessage = this.geolocation.errorMessage;

  constructor() {
    this.nearbyStations.ensureLoaded();
  }

  protected showStation(stationId: string): void {
    void this.router.navigate(['/stations', stationId]);
  }
}

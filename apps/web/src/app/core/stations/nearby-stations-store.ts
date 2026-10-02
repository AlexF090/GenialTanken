import { computed, inject, Injectable } from '@angular/core';
import { GeolocationService } from '../geolocation/geolocation-service';
import { SettingsStore } from '../settings/settings-store';
import { describeStationsError } from './stations-error-message';
import { StationsApi } from './stations-api';

/**
 * Stations around the user's position for the chosen fuel type and radius. Shared by the list
 * and the map page so switching between them does not refetch. Any change of position, fuel
 * type or radius triggers a new request.
 */
@Injectable({ providedIn: 'root' })
export class NearbyStationsStore {
  private readonly geolocation = inject(GeolocationService);
  private readonly settings = inject(SettingsStore);

  private readonly stationsResource = inject(StationsApi).stationsAround(() => {
    const position = this.geolocation.position();
    if (position === undefined) {
      return undefined;
    }
    return {
      latitude: position.latitude,
      longitude: position.longitude,
      radiusInKilometers: this.settings.radiusInKilometers(),
      fuelType: this.settings.fuelType(),
    };
  });

  readonly stations = computed(() =>
    this.stationsResource.hasValue() ? this.stationsResource.value() : []
  );
  readonly hasLoaded = computed(() => this.stationsResource.hasValue());
  readonly isLoading = computed(
    () => this.stationsResource.isLoading() || this.geolocation.isLocating()
  );
  readonly errorMessage = computed(() => {
    const error = this.stationsResource.error();
    return error === undefined ? undefined : describeStationsError(error);
  });

  /** Locates the user on first use; later calls reuse the known position. */
  ensureLoaded(): void {
    this.geolocation.locateOnce();
  }

  /** Relocates the user and fetches fresh prices. */
  refresh(): void {
    this.geolocation.locate();
    this.stationsResource.reload();
  }
}

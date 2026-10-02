import { computed, inject, Injectable, signal } from '@angular/core';
import type { Place } from '@genialtanken/contracts';
import type { Coordinates } from '../geolocation/coordinates';
import { GeolocationService } from '../geolocation/geolocation-service';
import { DEFAULT_SEARCH_CENTER, isSameSearchCenter } from './search-center';
import type { SearchCenter } from './search-center';

const OWN_POSITION_LABEL = 'Dein Standort';
const MAP_AREA_LABEL = 'Kartenmitte';

/**
 * Center of the station search. Every visit starts at {@link DEFAULT_SEARCH_CENTER}; the user's
 * position is only requested on an explicit action. Setting an identical center does not notify
 * dependents, so it causes no refetch.
 */
@Injectable({ providedIn: 'root' })
export class SearchCenterStore {
  private readonly geolocation = inject(GeolocationService);
  private readonly state = signal<SearchCenter>(DEFAULT_SEARCH_CENTER, {
    equal: isSameSearchCenter,
  });
  /** Location errors only matter until the user picks another center. */
  private readonly isLocationErrorRelevant = signal(false);
  /** Increased on every center change, so a late position does not override a newer choice. */
  private centerChangeCount = 0;

  readonly center = this.state.asReadonly();
  readonly isLocating = this.geolocation.isLocating;
  readonly locationErrorMessage = computed(() =>
    this.isLocationErrorRelevant() ? this.geolocation.errorMessage() : undefined
  );

  /**
   * Requests the user's position and centers on it. Never rejects; on failure the previous center
   * stays and `locationErrorMessage` explains why.
   */
  async useOwnPosition(): Promise<void> {
    const centerChangeCountAtStart = this.changeCenter();
    this.isLocationErrorRelevant.set(true);
    await this.geolocation.locate();
    const position = this.geolocation.position();
    const hasFailed = this.geolocation.errorMessage() !== undefined;
    if (
      hasFailed ||
      position === undefined ||
      centerChangeCountAtStart !== this.centerChangeCount
    ) {
      return;
    }
    this.state.set({
      latitude: position.latitude,
      longitude: position.longitude,
      label: OWN_POSITION_LABEL,
      source: 'own-position',
    });
  }

  usePlace(place: Place): void {
    this.changeCenter();
    this.state.set({
      latitude: place.latitude,
      longitude: place.longitude,
      label: place.name,
      source: 'place',
    });
  }

  /** Searches around a point the user moved the map to ("In diesem Bereich suchen"). */
  useMapArea(coordinates: Coordinates): void {
    this.changeCenter();
    this.state.set({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      label: MAP_AREA_LABEL,
      source: 'map-area',
    });
  }

  resetToDefault(): void {
    this.changeCenter();
    this.state.set(DEFAULT_SEARCH_CENTER);
  }

  private changeCenter(): number {
    this.centerChangeCount += 1;
    this.isLocationErrorRelevant.set(false);
    return this.centerChangeCount;
  }
}

import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type GeolocationFailure = 'permission-denied' | 'unavailable' | 'timeout' | 'unsupported';

/** The browser's Geolocation API, or `null` when the browser has none. */
export const GEOLOCATION = new InjectionToken<Geolocation | null>('Geolocation', {
  providedIn: 'root',
  factory: () => ('geolocation' in navigator ? navigator.geolocation : null),
});

const GEOLOCATION_ERROR_CODE_PERMISSION_DENIED = 1;
const GEOLOCATION_ERROR_CODE_TIMEOUT = 3;
const POSITION_TIMEOUT_IN_MILLISECONDS = 15_000;
const MAXIMUM_POSITION_AGE_IN_MILLISECONDS = 60_000;

const FAILURE_MESSAGES: Record<GeolocationFailure, string> = {
  'permission-denied':
    'Der Zugriff auf deinen Standort wurde verweigert. Erlaube ihn in den Einstellungen deines Browsers, um Tankstellen in deiner Nähe zu sehen.',
  unavailable: 'Dein Standort konnte nicht ermittelt werden. Bitte versuche es erneut.',
  timeout: 'Die Ermittlung deines Standorts hat zu lange gedauert. Bitte versuche es erneut.',
  unsupported: 'Dein Browser unterstützt keine Standortermittlung.',
};

const toFailure = (error: GeolocationPositionError): GeolocationFailure => {
  if (error.code === GEOLOCATION_ERROR_CODE_PERMISSION_DENIED) {
    return 'permission-denied';
  }
  if (error.code === GEOLOCATION_ERROR_CODE_TIMEOUT) {
    return 'timeout';
  }
  return 'unavailable';
};

const isSamePosition = (first: Coordinates | undefined, second: Coordinates | undefined): boolean =>
  first?.latitude === second?.latitude && first?.longitude === second?.longitude;

/** Current position of the user. The last known position is kept while relocating. */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private readonly geolocation = inject(GEOLOCATION);
  private readonly currentPosition = signal<Coordinates | undefined>(undefined, {
    equal: isSamePosition,
  });
  private readonly locating = signal(false);
  private readonly failure = signal<GeolocationFailure | undefined>(undefined);
  private hasRequestedPosition = false;

  readonly position = this.currentPosition.asReadonly();
  readonly isLocating = this.locating.asReadonly();
  readonly errorMessage = computed(() => {
    const failure = this.failure();
    return failure === undefined ? undefined : FAILURE_MESSAGES[failure];
  });

  /** Requests the position unless it was requested before (e.g. on another page). */
  locateOnce(): void {
    if (this.hasRequestedPosition) {
      return;
    }
    this.locate();
  }

  locate(): void {
    this.hasRequestedPosition = true;
    if (this.geolocation === null) {
      this.failure.set('unsupported');
      return;
    }
    this.locating.set(true);
    this.geolocation.getCurrentPosition(
      position => {
        this.currentPosition.set({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        this.failure.set(undefined);
        this.locating.set(false);
      },
      error => {
        this.failure.set(toFailure(error));
        this.locating.set(false);
      },
      {
        enableHighAccuracy: false,
        timeout: POSITION_TIMEOUT_IN_MILLISECONDS,
        maximumAge: MAXIMUM_POSITION_AGE_IN_MILLISECONDS,
      }
    );
  }
}

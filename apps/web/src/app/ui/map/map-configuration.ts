import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { Coordinates } from '../../core/geolocation/coordinates';

/** Shown until the user's position is known (Paris, where most stations of the data source are). */
export const FALLBACK_MAP_CENTER: Coordinates = { latitude: 48.8566, longitude: 2.3522 };
export const FALLBACK_MAP_ZOOM = 11;
export const OWN_POSITION_ZOOM = 13;
export const STATION_LOCATION_ZOOM = 16;

/** Public Mapbox token; empty means OpenStreetMap tiles are used instead. */
export const MAPBOX_ACCESS_TOKEN = new InjectionToken<string>('MapboxAccessToken', {
  providedIn: 'root',
  factory: () => environment.mapboxAccessToken,
});

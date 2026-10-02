import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

export const STATION_LOCATION_ZOOM = 16;

/** Public Mapbox token; empty means OpenStreetMap tiles are used instead. */
export const MAPBOX_ACCESS_TOKEN = new InjectionToken<string>('MapboxAccessToken', {
  providedIn: 'root',
  factory: () => environment.mapboxAccessToken,
});

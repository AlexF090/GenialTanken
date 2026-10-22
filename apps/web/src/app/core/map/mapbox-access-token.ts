import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Public Mapbox token of this build; empty means OpenStreetMap tiles are used instead. Not the
 * build-time constant `MAPBOX_ACCESS_TOKEN`, which only `environment.production.ts` reads.
 */
export const CONFIGURED_MAPBOX_ACCESS_TOKEN = new InjectionToken<string>('MapboxAccessToken', {
  providedIn: 'root',
  factory: () => environment.mapboxAccessToken,
});

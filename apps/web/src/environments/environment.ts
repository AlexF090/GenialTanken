import type { EnvironmentConfiguration } from './environment-configuration';

/** Local development and unit tests: no Mapbox token, so the map uses OpenStreetMap tiles. */
export const environment: EnvironmentConfiguration = {
  mapboxAccessToken: '',
};

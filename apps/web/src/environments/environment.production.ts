import type { EnvironmentConfiguration } from './environment-configuration';

/**
 * `MAPBOX_ACCESS_TOKEN` is replaced at build time through the `define` option of the Angular
 * application builder. The `build` script of apps/web passes the environment variable
 * `NG_APP_MAPBOX_ACCESS_TOKEN` (set by CI) as `--define`; angular.json defaults it to ''.
 *
 * The token is a public (`pk.`) Mapbox token restricted to the app's URLs, so shipping it in
 * the bundle is intended. Without a token the map falls back to OpenStreetMap tiles.
 */
export const environment: EnvironmentConfiguration = {
  mapboxAccessToken: typeof MAPBOX_ACCESS_TOKEN === 'string' ? MAPBOX_ACCESS_TOKEN : '',
};

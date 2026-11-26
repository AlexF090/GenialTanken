import type { EnvironmentConfiguration } from './environment-configuration';

/**
 * Production build for the browser end-to-end tests (`ng build --configuration production,e2e`):
 * the e2e PWA server proxies same-origin `/api` to the test API, so no CORS and no Render, and no
 * Mapbox token (OpenStreetMap tiles, which the suite mocks).
 */
export const environment: EnvironmentConfiguration = {
  mapboxAccessToken: '',
  apiBaseUrl: '/api',
};

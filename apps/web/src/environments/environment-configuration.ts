export interface EnvironmentConfiguration {
  /** Public Mapbox token (`pk.…`). Empty string falls back to OpenStreetMap tiles. */
  mapboxAccessToken: string;
  /**
   * Base URL of the API without trailing slash: `/api` (same origin, served by the dev proxy)
   * locally, the absolute URL of the API on Render in production.
   */
  apiBaseUrl: string;
}

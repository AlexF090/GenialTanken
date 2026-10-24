import { PRIMARY_OUTLET } from '@angular/router';
import type { UrlTree } from '@angular/router';

/**
 * Child routes of the explore page. Only paths and URL matching live here, because the route
 * configuration and the shell need them at startup; helpers of the lazy pages live next to it
 * (`station-route.ts`, `close-to-explore.ts`, `current-url.ts`), so they stay out of the initial
 * bundle.
 */
export const FAVORITES_ROUTE_PATH = 'favorites';
export const SETTINGS_ROUTE_PATH = 'settings';
export const STATIONS_SEGMENT = 'stations';

/** Route of a station's card. */
export const STATION_ROUTE_PATH = `${STATIONS_SEGMENT}/:id`;

/** Paths of the primary outlet's segments, e.g. `['stations', 'fr-75001001']`. */
export const pathSegmentsOf = (url: UrlTree): string[] =>
  url.root.children[PRIMARY_OUTLET]?.segments.map(segment => segment.path) ?? [];

/** Whether the URL is exactly `/<path>`, e.g. the favorites in the sheet. */
export const isRouteOpen = (url: UrlTree, path: string): boolean => {
  const segments = pathSegmentsOf(url);
  return segments.length === 1 && segments[0] === path;
};

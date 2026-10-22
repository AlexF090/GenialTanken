import type { UrlTree } from '@angular/router';
import { pathSegmentsOf } from './current-url';

/** Child routes of the explore page next to the station cards (`station-route.ts`). */
export const FAVORITES_ROUTE_PATH = 'favorites';
export const SETTINGS_ROUTE_PATH = 'settings';

/** Whether the URL is exactly `/<path>`, e.g. the favorites in the sheet. */
export const isRouteOpen = (url: UrlTree, path: string): boolean => {
  const segments = pathSegmentsOf(url);
  return segments.length === 1 && segments[0] === path;
};

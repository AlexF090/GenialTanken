import { computed } from '@angular/core';
import type { Signal } from '@angular/core';
import type { UrlTree } from '@angular/router';
import { injectCurrentUrl } from './current-url';
import { pathSegmentsOf, STATIONS_SEGMENT } from './explore-routes';

/** Commands for `routerLink` or `Router.navigate` that open the card of a station. */
export const stationRoute = (stationIdentifier: string): string[] => [
  `/${STATIONS_SEGMENT}`,
  stationIdentifier,
];

/** `/stations/<id>` opens the card of a station. */
export const stationIdentifierIn = (url: UrlTree | undefined): string | undefined => {
  const segments = url === undefined ? [] : pathSegmentsOf(url);
  return segments.length === 2 && segments[0] === STATIONS_SEGMENT ? segments[1] : undefined;
};

/**
 * Station whose card the current URL opens, updated after every navigation. Call it in an
 * injection context, e.g. a field initializer of the page.
 */
export const injectOpenedStationIdentifier = (): Signal<string | undefined> => {
  const currentUrl = injectCurrentUrl();
  return computed(() => stationIdentifierIn(currentUrl()));
};

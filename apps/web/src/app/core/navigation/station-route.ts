import { inject } from '@angular/core';
import type { Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, PRIMARY_OUTLET, Router } from '@angular/router';
import type { UrlTree } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

const STATIONS_SEGMENT = 'stations';

/** Route of a station's card, as a child of the explore page. */
export const STATION_ROUTE_PATH = `${STATIONS_SEGMENT}/:id`;

/** Commands for `routerLink` or `Router.navigate` that open the card of a station. */
export const stationRoute = (stationIdentifier: string): string[] => [
  `/${STATIONS_SEGMENT}`,
  stationIdentifier,
];

/** `/stations/<id>` opens the card of a station. */
export const stationIdentifierIn = (url: UrlTree | undefined): string | undefined => {
  const segments = url?.root.children[PRIMARY_OUTLET]?.segments ?? [];
  return segments.length === 2 && segments[0]?.path === STATIONS_SEGMENT
    ? segments[1]?.path
    : undefined;
};

/**
 * Station whose card the current URL opens, updated after every navigation. Call it in an
 * injection context, e.g. a field initializer of the page.
 */
export const injectOpenedStationIdentifier = (): Signal<string | undefined> => {
  const router = inject(Router);
  return toSignal(
    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(event => router.parseUrl(event.urlAfterRedirects)),
      // The page is created during the navigation to it, before its `NavigationEnd`.
      startWith(router.currentNavigation()?.finalUrl ?? router.parseUrl(router.url)),
      map(stationIdentifierIn)
    ),
    { initialValue: undefined }
  );
};

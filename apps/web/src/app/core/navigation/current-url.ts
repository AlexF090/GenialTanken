import { inject } from '@angular/core';
import type { Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, PRIMARY_OUTLET, Router } from '@angular/router';
import type { UrlTree } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

/**
 * The URL after every navigation. Call it in an injection context, e.g. a field initializer of
 * the page.
 */
export const injectCurrentUrl = (): Signal<UrlTree> => {
  const router = inject(Router);
  return toSignal(
    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(event => router.parseUrl(event.urlAfterRedirects)),
      // The page is created during the navigation to it, before its `NavigationEnd`.
      startWith(router.currentNavigation()?.finalUrl ?? router.parseUrl(router.url))
    ),
    { requireSync: true }
  );
};

/** Paths of the primary outlet's segments, e.g. `['stations', 'fr-75001001']`. */
export const pathSegmentsOf = (url: UrlTree): string[] =>
  url.root.children[PRIMARY_OUTLET]?.segments.map(segment => segment.path) ?? [];

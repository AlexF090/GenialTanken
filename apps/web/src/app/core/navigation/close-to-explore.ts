import { Location } from '@angular/common';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Navigation, UrlTree } from '@angular/router';
import { pathSegmentsOf } from './explore-routes';

/** The explore page itself, without a card or dialog over it. */
const isExplorePage = (url: UrlTree | undefined): boolean =>
  url !== undefined && pathSegmentsOf(url).length === 0;

/**
 * Whether the history entry before the current one is the explore page. Known only when the app
 * pushed the current entry itself; after Back or Forward the entry before is not the previous
 * navigation.
 */
const cameFromExplorePage = (navigation: Navigation | null): boolean =>
  navigation !== null &&
  navigation.trigger === 'imperative' &&
  navigation.extras.replaceUrl !== true &&
  navigation.extras.skipLocationChange !== true &&
  isExplorePage(navigation.previousNavigation?.finalUrl);

/**
 * Closes a card or dialog of the explore page. It goes back when the app came from the explore
 * page, so Back afterwards does not open again what was just closed; otherwise, e.g. after a deep
 * link, the explore page replaces the current entry. Call it in an injection context.
 */
export const injectCloseToExplore = (): (() => void) => {
  const router = inject(Router);
  const location = inject(Location);
  return () => {
    if (cameFromExplorePage(router.lastSuccessfulNavigation())) {
      location.back();
      return;
    }
    void router.navigateByUrl('/', { replaceUrl: true });
  };
};

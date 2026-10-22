import type { Signal } from '@angular/core';
import { injectMediaQueryMatches } from './media-query';

export const REDUCED_MOTION_MEDIA_QUERY = '(prefers-reduced-motion: reduce)';

/** Whether the user asked for less motion, e.g. to jump instead of animating the map. */
export const injectPrefersReducedMotion = (): Signal<boolean> =>
  injectMediaQueryMatches(REDUCED_MOTION_MEDIA_QUERY);

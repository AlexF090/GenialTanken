import { Injectable } from '@angular/core';
import { COMPACT_MEDIA_QUERY } from './breakpoints';
import { injectMediaQueryMatches } from './media-query';

/**
 * Window size class for layout decisions that CSS alone cannot make, such as rendering a bottom
 * sheet instead of a side pane. Prefer the `breakpoints` SCSS mixins for pure styling.
 */
@Injectable({ providedIn: 'root' })
export class Viewport {
  /** `true` below 48rem (phones). `false` where `matchMedia` is unavailable. */
  readonly isCompactViewport = injectMediaQueryMatches(COMPACT_MEDIA_QUERY);
}

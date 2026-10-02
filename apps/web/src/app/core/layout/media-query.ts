import { DestroyRef, DOCUMENT, inject, InjectionToken, signal } from '@angular/core';
import type { Signal } from '@angular/core';

/** The part of `MediaQueryList` the app relies on, so tests can provide a small fake. */
export interface WatchedMediaQuery {
  readonly matches: boolean;
  addEventListener(type: 'change', listener: (event: { matches: boolean }) => void): void;
  removeEventListener(type: 'change', listener: (event: { matches: boolean }) => void): void;
}

export type MatchMedia = (query: string) => WatchedMediaQuery;

/** `window.matchMedia` in the browser; `null` where it does not exist (server, jsdom). */
export const MATCH_MEDIA = new InjectionToken<MatchMedia | null>('MatchMedia', {
  providedIn: 'root',
  factory: () => {
    const window = inject(DOCUMENT).defaultView;
    if (window === null || typeof window.matchMedia !== 'function') {
      return null;
    }
    return query => window.matchMedia(query);
  },
});

/**
 * Whether the media query currently matches, updated on every change until the surrounding
 * injector is destroyed. Must run in an injection context. Without `matchMedia` the query is
 * treated as not matching.
 */
export const injectMediaQueryMatches = (query: string): Signal<boolean> => {
  const matchMedia = inject(MATCH_MEDIA);
  if (matchMedia === null) {
    return signal(false).asReadonly();
  }
  const mediaQuery = matchMedia(query);
  const matches = signal(mediaQuery.matches);
  const updateMatches = (event: { matches: boolean }): void => {
    matches.set(event.matches);
  };
  mediaQuery.addEventListener('change', updateMatches);
  inject(DestroyRef).onDestroy(() => {
    mediaQuery.removeEventListener('change', updateMatches);
  });
  return matches.asReadonly();
};

import { DOCUMENT, inject, InjectionToken } from '@angular/core';

export type Share = (data: ShareData) => Promise<void>;

/**
 * The system share sheet (`navigator.share`), or `undefined` where the browser has none, e.g.
 * Firefox on the desktop. Replaced in tests.
 */
export const SHARE = new InjectionToken<Share | undefined>('SHARE', {
  providedIn: 'root',
  factory: () => {
    const navigator = inject(DOCUMENT).defaultView?.navigator;
    if (navigator === undefined || typeof navigator.share !== 'function') {
      return undefined;
    }
    return data => navigator.share(data);
  },
});

/** The user closed the share sheet without sharing; not a failure. */
export const isShareCanceled = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

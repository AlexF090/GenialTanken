import { DOCUMENT, inject, InjectionToken } from '@angular/core';

/**
 * Opens a link outside the app, e.g. a route in a navigation app. A new browsing context keeps
 * the installed web app where it was when the link falls back to a website.
 */
export const OPEN_EXTERNAL_URL = new InjectionToken<(url: string) => void>('OPEN_EXTERNAL_URL', {
  providedIn: 'root',
  factory: () => {
    const window = inject(DOCUMENT).defaultView;
    return url => {
      window?.open(url, '_blank', 'noopener');
    };
  },
});

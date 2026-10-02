import { InjectionToken } from '@angular/core';

/** Persistent key-value storage; `localStorage` in the browser, a fake in tests. */
export const BROWSER_STORAGE = new InjectionToken<Storage>('BrowserStorage', {
  providedIn: 'root',
  factory: () => localStorage,
});

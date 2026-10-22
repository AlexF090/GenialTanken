import { InjectionToken } from '@angular/core';

/** Persistent key-value storage; `localStorage` in the browser, a fake in tests. */
export const BROWSER_STORAGE = new InjectionToken<Storage>('BrowserStorage', {
  providedIn: 'root',
  factory: () => localStorage,
});

/** Storage for the current tab only; `sessionStorage` in the browser, a fake in tests. */
export const SESSION_STORAGE = new InjectionToken<Storage>('SessionStorage', {
  providedIn: 'root',
  factory: () => sessionStorage,
});

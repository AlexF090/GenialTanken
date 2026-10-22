import { DestroyRef, DOCUMENT, effect, inject, Injectable, signal, untracked } from '@angular/core';

/**
 * Whether the browser reports a network connection (`navigator.onLine`, updated by the `online`
 * and `offline` events). `true` only means a network exists, not that the API answers; `false`
 * is reliable, so the app uses it to explain failed requests.
 */
@Injectable({ providedIn: 'root' })
export class NetworkStatus {
  private readonly online = signal(true);
  readonly isOnline = this.online.asReadonly();

  constructor() {
    const window = inject(DOCUMENT).defaultView;
    if (window === null) {
      return;
    }
    this.online.set(window.navigator.onLine);
    const goOnline = (): void => {
      this.online.set(true);
    };
    const goOffline = (): void => {
      this.online.set(false);
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    });
  }
}

interface Reloadable {
  reload(): unknown;
}

/**
 * Reloads the resource whenever the connection comes back, so prices that failed offline load
 * without a tap. Must run in an injection context; stops with the surrounding injector.
 */
export const reloadWhenReconnected = (resource: Reloadable): void => {
  const isOnline = inject(NetworkStatus).isOnline;
  let wasOffline = !untracked(isOnline);
  effect(() => {
    const online = isOnline();
    if (online && wasOffline) {
      untracked(() => resource.reload());
    }
    wasOffline = !online;
  });
};

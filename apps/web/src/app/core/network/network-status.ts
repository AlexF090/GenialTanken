import { DestroyRef, DOCUMENT, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { Signal } from '@angular/core';
import { MILLISECONDS_PER_SECOND } from '@genialtanken/contracts';

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

/**
 * `online` often fires before the connection carries requests (Wi-Fi still negotiating, captive
 * portals), so the reload waits a moment and retries once after a longer pause.
 */
export const RECONNECT_DELAY_IN_MILLISECONDS = 1 * MILLISECONDS_PER_SECOND;
export const RETRY_DELAY_IN_MILLISECONDS = 4 * MILLISECONDS_PER_SECOND;

/** The part of a `Resource` that `reloadWhenReconnected` needs. */
interface Reloadable {
  readonly isLoading: Signal<boolean>;
  readonly error: Signal<unknown>;
  reload(): unknown;
}

/**
 * Reloads the resource whenever the connection comes back, so prices that failed offline load
 * without a tap; a failed reload is retried once. Must run in an injection context; stops with
 * the surrounding injector.
 */
export const reloadWhenReconnected = (resource: Reloadable): void => {
  const isOnline = inject(NetworkStatus).isOnline;
  let wasOffline = !untracked(isOnline);
  let pendingReload: ReturnType<typeof setTimeout> | undefined;
  let mayRetry = false;
  const awaitingReloadResult = signal(false);

  const cancelPendingReload = (): void => {
    clearTimeout(pendingReload);
    pendingReload = undefined;
  };
  const reloadAfter = (delayInMilliseconds: number): void => {
    cancelPendingReload();
    pendingReload = setTimeout(() => {
      pendingReload = undefined;
      resource.reload();
      awaitingReloadResult.set(true);
    }, delayInMilliseconds);
  };

  effect(() => {
    const online = isOnline();
    if (!online) {
      cancelPendingReload();
      mayRetry = false;
      awaitingReloadResult.set(false);
    } else if (wasOffline) {
      mayRetry = true;
      reloadAfter(RECONNECT_DELAY_IN_MILLISECONDS);
    }
    wasOffline = !online;
  });

  effect(() => {
    if (!awaitingReloadResult() || resource.isLoading()) {
      return;
    }
    awaitingReloadResult.set(false);
    if (resource.error() !== undefined && mayRetry) {
      mayRetry = false;
      reloadAfter(RETRY_DELAY_IN_MILLISECONDS);
    }
  });

  inject(DestroyRef).onDestroy(cancelPendingReload);
};

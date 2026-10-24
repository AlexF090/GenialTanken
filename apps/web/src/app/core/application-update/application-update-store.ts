import {
  DestroyRef,
  DOCUMENT,
  inject,
  Injectable,
  InjectionToken,
  Injector,
  signal,
} from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_SECOND } from '@genialtanken/contracts';
import { SESSION_STORAGE } from '../browser-storage';
import { Logger } from '../logging/logger';

/** Reloads the page; a token so tests can observe it instead of reloading jsdom. */
export const RELOAD_PAGE = new InjectionToken<() => void>('RELOAD_PAGE', {
  providedIn: 'root',
  factory: () => {
    const location = inject(DOCUMENT).location;
    return () => {
      location.reload();
    };
  },
});

/** When this tab last reloaded on its own because of a broken cache, in epoch milliseconds. */
export const AUTOMATIC_RELOAD_STORAGE_KEY = 'genialtanken.automatic-reload';

/**
 * A cache that breaks again within this time after an automatic reload stays broken, so the
 * user reloads by hand; a cache that breaks later (e.g. evicted again in a long session) gets
 * another automatic reload. This bounds automatic reloads without a reload loop.
 */
export const MINIMUM_TIME_BETWEEN_AUTOMATIC_RELOADS_IN_MILLISECONDS = 10 * MILLISECONDS_PER_MINUTE;

/** A service worker that does not answer must not keep "Neu laden" from reloading. */
export const ACTIVATION_TIMEOUT_IN_MILLISECONDS = 3 * MILLISECONDS_PER_SECOND;

/**
 * Why the app asks for a reload: a new version is ready, or the cached version is broken and
 * reloading on its own did not help.
 */
export type PendingReload = 'update-ready' | 'reload-required';

/**
 * New app versions installed by the service worker. The app looks for one whenever it becomes
 * visible again; a ready version waits until the user asks for it (`reload`), so a page never
 * changes under their hands. A broken cache (`unrecoverable`) reloads at once, because the
 * running version cannot load its lazy chunks; but at most once within
 * `MINIMUM_TIME_BETWEEN_AUTOMATIC_RELOADS_IN_MILLISECONDS`, so a cache that stays broken cannot
 * reload the page in a loop. After that the user reloads by hand.
 */
@Injectable({ providedIn: 'root' })
export class ApplicationUpdateStore {
  private readonly serviceWorkerUpdate = inject(SwUpdate);
  private readonly reloadPage = inject(RELOAD_PAGE);
  private readonly injector = inject(Injector);
  private readonly logger = inject(Logger);
  private readonly pendingReloadState = signal<PendingReload | undefined>(undefined);

  readonly pendingReload = this.pendingReloadState.asReadonly();

  constructor() {
    if (!this.serviceWorkerUpdate.isEnabled) {
      return;
    }
    const versionUpdates = this.serviceWorkerUpdate.versionUpdates.subscribe(event => {
      if (event.type === 'VERSION_READY' && this.pendingReloadState() === undefined) {
        this.pendingReloadState.set('update-ready');
      }
    });
    const unrecoverable = this.serviceWorkerUpdate.unrecoverable.subscribe(event => {
      this.logger.error('The service worker cannot serve this app version', event.reason);
      if (this.rememberAutomaticReload()) {
        this.reloadPage();
        return;
      }
      this.pendingReloadState.set('reload-required');
    });
    const document = inject(DOCUMENT);
    const checkWhenVisible = (): void => {
      if (document.visibilityState === 'visible') {
        void this.checkForUpdate();
      }
    };
    document.addEventListener('visibilitychange', checkWhenVisible);
    inject(DestroyRef).onDestroy(() => {
      versionUpdates.unsubscribe();
      unrecoverable.unsubscribe();
      document.removeEventListener('visibilitychange', checkWhenVisible);
    });
  }

  /**
   * Switches to the ready version and reloads, so every chunk comes from that version. A broken
   * cache has no version to switch to; the reload alone lets the service worker start over.
   */
  async reload(): Promise<void> {
    if (this.pendingReloadState() === 'reload-required') {
      this.reloadPage();
      return;
    }
    let activationTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.serviceWorkerUpdate.activateUpdate(),
        new Promise<never>((_resolve, reject) => {
          activationTimeout = setTimeout(() => {
            reject(new Error('The service worker did not activate the new version in time'));
          }, ACTIVATION_TIMEOUT_IN_MILLISECONDS);
        }),
      ]);
    } catch (error: unknown) {
      // A reload still loads the newest version the service worker has.
      this.logger.error('Activating the new app version failed', error);
    } finally {
      clearTimeout(activationTimeout);
    }
    this.reloadPage();
  }

  private async checkForUpdate(): Promise<void> {
    try {
      await this.serviceWorkerUpdate.checkForUpdate();
    } catch (error: unknown) {
      // Offline or a missing ngsw.json; the next visit checks again.
      this.logger.warn('Checking for a new app version failed', error);
    }
  }

  /** False if this tab reloaded on its own recently or cannot remember doing so. */
  private rememberAutomaticReload(): boolean {
    try {
      // Resolved here: with storage blocked, merely reading `sessionStorage` throws.
      const sessionStorage = this.injector.get(SESSION_STORAGE);
      const now = Date.now();
      const lastAutomaticReload = sessionStorage.getItem(AUTOMATIC_RELOAD_STORAGE_KEY);
      if (lastAutomaticReload !== null && !isLongAgo(lastAutomaticReload, now)) {
        return false;
      }
      sessionStorage.setItem(AUTOMATIC_RELOAD_STORAGE_KEY, String(now));
      return true;
    } catch (error: unknown) {
      this.logger.error('Cannot remember the automatic reload for this session', error);
      return false;
    }
  }
}

/** A marker that is no timestamp (older app versions stored `true`) counts as recent. */
const isLongAgo = (storedTimestamp: string, now: number): boolean => {
  const timestamp = Number(storedTimestamp);
  return (
    Number.isFinite(timestamp) &&
    now - timestamp >= MINIMUM_TIME_BETWEEN_AUTOMATIC_RELOADS_IN_MILLISECONDS
  );
};

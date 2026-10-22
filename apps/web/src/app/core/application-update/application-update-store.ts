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

/** Marks that this tab already reloaded on its own because of a broken cache. */
export const AUTOMATIC_RELOAD_STORAGE_KEY = 'genialtanken.automatic-reload';

/**
 * Why the app asks for a reload: a new version is ready, or the cached version is broken and
 * reloading on its own did not help.
 */
export type PendingReload = 'update-ready' | 'reload-required';

/**
 * New app versions installed by the service worker. A ready version waits until the user asks
 * for it (`reload`), so a page never changes under their hands. A broken cache
 * (`unrecoverable`) reloads at once, because the running version cannot load its lazy chunks;
 * but only once per session, so a cache that stays broken cannot reload the page in a loop.
 * After that the user reloads by hand.
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
    inject(DestroyRef).onDestroy(() => {
      versionUpdates.unsubscribe();
      unrecoverable.unsubscribe();
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
    try {
      await this.serviceWorkerUpdate.activateUpdate();
    } catch (error: unknown) {
      // A reload still loads the newest version the service worker has.
      this.logger.error('Activating the new app version failed', error);
    }
    this.reloadPage();
  }

  /** False if this session already reloaded on its own or cannot remember doing so. */
  private rememberAutomaticReload(): boolean {
    try {
      // Resolved here: with storage blocked, merely reading `sessionStorage` throws.
      const sessionStorage = this.injector.get(SESSION_STORAGE);
      if (sessionStorage.getItem(AUTOMATIC_RELOAD_STORAGE_KEY) !== null) {
        return false;
      }
      sessionStorage.setItem(AUTOMATIC_RELOAD_STORAGE_KEY, 'true');
      return true;
    } catch (error: unknown) {
      this.logger.error('Cannot remember the automatic reload for this session', error);
      return false;
    }
  }
}

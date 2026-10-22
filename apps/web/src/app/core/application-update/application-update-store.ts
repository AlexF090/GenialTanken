import { DestroyRef, DOCUMENT, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
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

/**
 * New app versions installed by the service worker. A ready version waits until the user asks
 * for it (`reload`), so a page never changes under their hands. A broken cache
 * (`unrecoverable`) reloads at once, because the running version cannot load its lazy chunks.
 */
@Injectable({ providedIn: 'root' })
export class ApplicationUpdateStore {
  private readonly serviceWorkerUpdate = inject(SwUpdate);
  private readonly reloadPage = inject(RELOAD_PAGE);
  private readonly logger = inject(Logger);
  private readonly updateReady = signal(false);

  readonly isUpdateReady = this.updateReady.asReadonly();

  constructor() {
    if (!this.serviceWorkerUpdate.isEnabled) {
      return;
    }
    const versionUpdates = this.serviceWorkerUpdate.versionUpdates.subscribe(event => {
      if (event.type === 'VERSION_READY') {
        this.updateReady.set(true);
      }
    });
    const unrecoverable = this.serviceWorkerUpdate.unrecoverable.subscribe(event => {
      this.logger.error('The service worker cannot serve this app version', event.reason);
      this.reloadPage();
    });
    inject(DestroyRef).onDestroy(() => {
      versionUpdates.unsubscribe();
      unrecoverable.unsubscribe();
    });
  }

  /** Switches to the ready version and reloads, so every chunk comes from that version. */
  async reload(): Promise<void> {
    try {
      await this.serviceWorkerUpdate.activateUpdate();
    } catch (error: unknown) {
      // A reload still loads the newest version the service worker has.
      this.logger.error('Activating the new app version failed', error);
    }
    this.reloadPage();
  }
}

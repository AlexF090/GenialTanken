import type { UnrecoverableStateEvent, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';

/** The part of `SwUpdate` the app uses; provide it with `{ provide: SwUpdate, useValue }`. */
export class FakeServiceWorkerUpdate {
  readonly versionUpdates = new Subject<VersionEvent>();
  readonly unrecoverable = new Subject<UnrecoverableStateEvent>();
  activations = 0;
  activationError: Error | undefined;
  /** Lets `activateUpdate` never settle, like a service worker that does not answer. */
  activationHangs = false;
  updateChecks = 0;
  updateCheckError: Error | undefined;

  constructor(readonly isEnabled = true) {}

  activateUpdate(): Promise<boolean> {
    this.activations += 1;
    if (this.activationHangs) {
      return new Promise<boolean>(() => undefined);
    }
    return this.activationError === undefined
      ? Promise.resolve(true)
      : Promise.reject(this.activationError);
  }

  checkForUpdate(): Promise<boolean> {
    this.updateChecks += 1;
    return this.updateCheckError === undefined
      ? Promise.resolve(false)
      : Promise.reject(this.updateCheckError);
  }

  announceReadyVersion(): void {
    this.versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'current' },
      latestVersion: { hash: 'latest' },
    });
  }
}

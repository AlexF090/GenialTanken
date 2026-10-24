import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { PendingReload } from '../../core/application-update/application-update-store';

const MESSAGES: Record<PendingReload, string> = {
  'update-ready': 'Neue Version verfügbar',
  'reload-required': 'Die App muss neu geladen werden.',
};

/**
 * Time for screen readers to register a new live region before its content changes; as long as
 * the CDK's `LiveAnnouncer` waits. Within one render they would not notice the change.
 */
export const LIVE_REGION_REGISTRATION_DELAY_IN_MILLISECONDS = 100;

/**
 * "Neue Version verfügbar" (or, for a broken cache, "Die App muss neu geladen werden.") with a
 * reload button. Screen readers announce only changes of a status region they know already, so
 * the region is always rendered and filled a moment after its first render, also when a reload is
 * pending as the notice appears (e.g. in the settings dialog). It never closes on a timer, so
 * nobody misses it (WCAG 2.2.3).
 */
@Component({
  selector: 'app-update-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="update-notice" role="status">
      @if (announcedPendingReload(); as pendingReload) {
        <div class="message toast update-notice__toast">
          <p>{{ messages[pendingReload] }}</p>
          <button type="button" class="button" (click)="reloadRequested.emit()">Neu laden</button>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    // Any author rule beats the user agent's [hidden] rule, the one above included.
    :host([hidden]) {
      display: none;
    }

    .update-notice {
      display: flex;
      justify-content: center;
    }

    .update-notice__toast {
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
      width: 100%;
      max-width: var(--layout-search-width-maximum);
      padding-inline-end: var(--space-sm);
      // The region around it may let taps through to the map.
      pointer-events: auto;
    }
  `,
})
export class UpdateNotice {
  readonly pendingReload = input<PendingReload | undefined>(undefined);
  readonly reloadRequested = output();

  protected readonly messages = MESSAGES;
  private readonly destroyRef = inject(DestroyRef);
  private readonly isRegionRendered = signal(false);
  protected readonly announcedPendingReload = computed(() =>
    this.isRegionRendered() ? this.pendingReload() : undefined
  );

  constructor() {
    afterNextRender(() => {
      const timeout = setTimeout(() => {
        this.isRegionRendered.set(true);
      }, LIVE_REGION_REGISTRATION_DELAY_IN_MILLISECONDS);
      this.destroyRef.onDestroy(() => {
        clearTimeout(timeout);
      });
    });
  }
}

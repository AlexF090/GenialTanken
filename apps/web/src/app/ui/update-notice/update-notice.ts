import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * "Neue Version verfügbar" with a reload button. The status region is always rendered, so screen
 * readers announce the notice when it appears. It never closes on a timer, so nobody misses it
 * (WCAG 2.2.3).
 */
@Component({
  selector: 'app-update-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="update-notice" role="status">
      @if (isUpdateReady()) {
        <div class="message toast update-notice__toast">
          <p>Neue Version verfügbar</p>
          <button type="button" class="button" (click)="reloadRequested.emit()">Neu laden</button>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
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
  readonly isUpdateReady = input.required<boolean>();
  readonly reloadRequested = output();
}

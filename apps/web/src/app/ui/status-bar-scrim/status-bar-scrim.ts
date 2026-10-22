import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Darkens the top of the map behind the status bar, so its white text (`black-translucent`)
 * stays legible over light map tiles. Purely decorative and never in the way of a tap. Shown on
 * phones, and on tablets as an installed app, where the map reaches under the status bar.
 */
@Component({
  selector: 'app-status-bar-scrim',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: '',
  styles: `
    @use 'breakpoints';

    :host {
      position: fixed;
      inset: 0 0 auto;
      z-index: var(--layer-status-bar-scrim);
      display: none;
      // Proportional, so it vanishes where nothing lies under the status bar (safe area 0).
      height: calc(var(--safe-area-top) * 1.5);
      background: linear-gradient(
        to bottom,
        var(--color-status-bar-scrim) var(--safe-area-top),
        var(--color-status-bar-scrim-end)
      );
      pointer-events: none;

      @include breakpoints.compact {
        display: block;
      }

      @media (display-mode: standalone) and (pointer: coarse) {
        display: block;
      }

      // System colors replace the gradient; the status bar brings its own backdrop there.
      @media (forced-colors: active) {
        display: none;
      }
    }
  `,
})
export class StatusBarScrim {}

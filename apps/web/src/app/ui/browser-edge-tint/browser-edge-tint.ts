import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Two opaque strips along the top and bottom edge of the window. Safari 26 and later tint the bars
 * behind the clock and the floating toolbar from fixed elements at the window edges and ignore
 * `theme-color`, so the strips continue the colors of the status bar area and of the sheet. Only
 * the Safari tab needs them (see the styles).
 */
@Component({
  selector: 'app-browser-edge-tint',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './browser-edge-tint.html',
  styleUrl: './browser-edge-tint.scss',
  host: {
    'aria-hidden': 'true',
  },
})
export class BrowserEdgeTint {}

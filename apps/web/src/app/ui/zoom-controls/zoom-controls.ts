import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * „+“ and „−“ for a map in one floating capsule, like the zoom buttons of Apple Maps. A button at
 * the end of the range stays focusable and is only marked unavailable, so the focus does not jump
 * away; the host ignores its presses.
 */
@Component({
  selector: 'app-zoom-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './zoom-controls.html',
  styleUrl: './zoom-controls.scss',
  host: {
    role: 'group',
    'aria-label': 'Zoom',
  },
})
export class ZoomControls {
  readonly canZoomIn = input.required<boolean>();
  readonly canZoomOut = input.required<boolean>();
  readonly zoomInRequested = output();
  readonly zoomOutRequested = output();
}

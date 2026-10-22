import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Link that opens in a new tab and says so to screen readers. */
@Component({
  selector: 'app-external-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a [href]="href()" target="_blank" rel="noopener noreferrer"
    ><ng-content /><span class="visually-hidden"> (öffnet in neuem Tab)</span></a
  >`,
})
export class ExternalLink {
  readonly href = input.required<string>();
}

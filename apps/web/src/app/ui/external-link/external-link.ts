import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';

/** Link that opens in a new tab and says so: with an icon to the eye, in words to screen readers. */
@Component({
  selector: 'app-external-link',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a [href]="href()" target="_blank" rel="noopener noreferrer"
    ><ng-content /><app-icon name="open-in-new" class="external-link__icon" /><span
      class="visually-hidden">
      (öffnet in neuem Tab)</span
    ></a
  >`,
  styles: `
    .external-link__icon {
      margin-inline-start: var(--space-3xs);
      vertical-align: middle;
    }
  `,
})
export class ExternalLink {
  readonly href = input.required<string>();
}

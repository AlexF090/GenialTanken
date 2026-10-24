import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

/**
 * The grey round ✕ of an iOS sheet: the circle is smaller than the 44 px touch target around it.
 * `label` names it for assistive technology, e.g. „Hinweis schließen“ where „Schließen“ alone
 * would be unclear.
 */
@Component({
  selector: 'app-close-button',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="icon-button icon-button--circled"
      [attr.aria-label]="label()"
      (click)="pressed.emit()">
      <span class="icon-button__circle"><app-icon name="close" /></span>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
  `,
})
export class CloseButton {
  readonly label = input('Schließen');
  readonly pressed = output();
}

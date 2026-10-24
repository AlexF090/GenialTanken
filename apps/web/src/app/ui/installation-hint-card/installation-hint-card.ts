import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { APPLICATION_NAME } from '../../core/application-name';
import { uniqueIdentifier } from '../../core/dom/unique-identifier';
import type { InstallationOffer } from '../../core/installation/installation-hint';
import { CloseButton } from '../close-button/close-button';
import { Icon } from '../icon/icon';

/**
 * Small card that suggests adding the app to the home screen: a button that opens the browser's
 * install dialog, or the steps of iOS, which has none. Closing it is final.
 */
@Component({
  selector: 'app-installation-hint-card',
  imports: [CloseButton, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './installation-hint-card.html',
  styleUrl: './installation-hint-card.scss',
})
export class InstallationHintCard {
  readonly offer = input.required<InstallationOffer>();
  readonly installRequested = output();
  readonly dismissed = output();

  protected readonly applicationName = APPLICATION_NAME;
  protected readonly headingIdentifier = uniqueIdentifier('installation-hint-heading');
}

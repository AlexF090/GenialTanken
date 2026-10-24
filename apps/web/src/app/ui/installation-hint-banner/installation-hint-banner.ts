import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { APPLICATION_NAME } from '../../core/application-name';
import { uniqueIdentifier } from '../../core/dom/unique-identifier';
import type { InstallationOffer } from '../../core/installation/installation-hint';
import { CloseButton } from '../close-button/close-button';
import { Icon } from '../icon/icon';

/**
 * One-line banner that suggests adding the app to the home screen: a button that opens the
 * browser's install dialog, or a disclosure button that reveals the steps of iOS, which has no
 * such dialog. Closing it is final.
 */
@Component({
  selector: 'app-installation-hint-banner',
  imports: [CloseButton, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './installation-hint-banner.html',
  styleUrl: './installation-hint-banner.scss',
})
export class InstallationHintBanner {
  readonly offer = input.required<InstallationOffer>();
  readonly installRequested = output();
  readonly dismissed = output();

  protected readonly applicationName = APPLICATION_NAME;
  protected readonly headingIdentifier = uniqueIdentifier('installation-hint-heading');
  protected readonly stepsIdentifier = uniqueIdentifier('installation-hint-steps');
  protected readonly areStepsShown = signal(false);

  protected toggleSteps(): void {
    this.areStepsShown.update(areShown => !areShown);
  }
}

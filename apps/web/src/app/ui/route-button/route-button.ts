import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { NAVIGATION_APPS } from '../../core/navigation-apps/navigation-apps';
import type { NavigationDestination } from '../../core/navigation-apps/navigation-apps';
import { OPEN_EXTERNAL_URL } from '../../core/navigation-apps/open-external-url';
import { Icon } from '../icon/icon';

/**
 * Starts a route to a station in a navigation app of the user's choice: the filled tile in the
 * action row of a station card. The choice is a native
 * `<select>` laid invisibly over the button, so phones show their own system picker.
 */
@Component({
  selector: 'app-route-button',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './route-button.html',
  styleUrl: './route-button.scss',
})
export class RouteButton {
  readonly destination = input.required<NavigationDestination>();

  private readonly openExternalUrl = inject(OPEN_EXTERNAL_URL);
  protected readonly apps = NAVIGATION_APPS;

  protected openRoute(select: HTMLSelectElement): void {
    const app = NAVIGATION_APPS.find(candidate => candidate.identifier === select.value);
    // Back to the prompt, so choosing the same app again fires `change` again.
    select.value = '';
    if (app !== undefined) {
      this.openExternalUrl(app.routeUrl(this.destination()));
    }
  }
}

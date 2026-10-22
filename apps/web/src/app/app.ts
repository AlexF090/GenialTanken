import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ApplicationUpdateStore } from './core/application-update/application-update-store';
import { injectCurrentUrl } from './core/navigation/current-url';
import { isRouteOpen, SETTINGS_ROUTE_PATH } from './core/navigation/explore-routes';
import { MAIN_CONTENT_IDENTIFIER } from './core/navigation/main-content';
import { UpdateNotice } from './ui/update-notice/update-notice';

/**
 * Application shell without any navigation bar: the map is the app, everything else opens in its
 * sheet, like Apple Maps. Every routed page renders its own single `<main>` with the identifier
 * `MAIN_CONTENT_IDENTIFIER`, the target of the skip link.
 *
 * A new app version is offered above every page until the user reloads. The modal settings
 * dialog makes everything outside it inert, the top layer included, so it shows the notice
 * itself while it is open.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UpdateNotice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The shell styles the host element of whichever page the router renders.
  encapsulation: ViewEncapsulation.None,
  template: `
    <a class="skip-link" [href]="'#' + mainContentIdentifier" (click)="skipToContent($event)"
      >Zum Inhalt springen</a
    >
    <router-outlet />
    <app-update-notice
      class="shell__notices"
      [hidden]="isSettingsOpen()"
      [isUpdateReady]="isUpdateReady()"
      (reloadRequested)="reloadApplication()" />
  `,
  styles: `
    app-root {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }

    // Floats at the bottom, above the sheet and the side panel.
    .shell__notices {
      position: fixed;
      right: calc(var(--safe-area-right) + var(--space-md));
      bottom: calc(var(--safe-area-bottom) + var(--space-md));
      left: calc(var(--safe-area-left) + var(--space-md));
      z-index: var(--layer-notice);
      // The empty region spans the width; only the notice itself takes taps.
      pointer-events: none;
    }

    // Zero specificity, so a page can override this on its own host.
    :where(app-root > router-outlet + *) {
      display: flex;
      flex: 1 0 auto;
      flex-direction: column;
    }
  `,
})
export class App {
  private readonly document = inject(DOCUMENT);
  private readonly applicationUpdate = inject(ApplicationUpdateStore);
  private readonly currentUrl = injectCurrentUrl();
  protected readonly mainContentIdentifier = MAIN_CONTENT_IDENTIFIER;
  protected readonly isUpdateReady = this.applicationUpdate.isUpdateReady;
  protected readonly isSettingsOpen = computed(() =>
    isRouteOpen(this.currentUrl(), SETTINGS_ROUTE_PATH)
  );

  protected reloadApplication(): void {
    void this.applicationUpdate.reload();
  }

  /**
   * A plain `#fragment` link would resolve against `<base href="/">` and reload the start page,
   * so the skip link moves focus itself; `focus()` also scrolls the content into view.
   */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    this.document.getElementById(MAIN_CONTENT_IDENTIFIER)?.focus();
  }
}

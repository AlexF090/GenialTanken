import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ApplicationUpdateStore } from './core/application-update/application-update-store';
import { NavigationBar } from './ui/navigation-bar/navigation-bar';

/**
 * Application shell: one navigation landmark that is a bottom bar on compact screens and a
 * navigation rail from the medium breakpoint on, next to the routed page.
 *
 * Every routed page renders its own single `<main>`. The skip link moves focus to the content
 * area that wraps the routed page, so keyboard users pass the navigation in one step.
 *
 * The document scrolls (so the router restores scroll positions). A page that has to fill the
 * remaining viewport, such as a map, sets `height: var(--layout-page-height)` on its host.
 *
 * A new app version is offered above every page until the user reloads; it never closes on a
 * timer, so nobody misses it (WCAG 2.2.3).
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavigationBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The shell styles the host element of whichever page the router renders.
  encapsulation: ViewEncapsulation.None,
  template: `
    <a class="skip-link" href="#main-content" (click)="skipToContent($event, content)"
      >Zum Inhalt springen</a
    >
    <app-navigation-bar class="shell__navigation" />
    <div class="shell__content" id="main-content" tabindex="-1" #content>
      <router-outlet />
    </div>
    <!-- Always rendered, so screen readers announce the notice when it appears. -->
    <div class="shell__notices" role="status">
      @if (isUpdateReady()) {
        <div class="message toast shell__update">
          <p>Neue Version verfügbar</p>
          <button type="button" class="button" (click)="reloadApplication()">Neu laden</button>
        </div>
      }
    </div>
  `,
  styles: `
    @use 'breakpoints';

    app-root {
      // Height left for a page next to the navigation; full-height pages (map) use it.
      --layout-page-height: calc(
        100dvh - var(--layout-navigation-height) - var(--safe-area-bottom)
      );

      display: grid;
      grid-template-areas:
        'content'
        'navigation';
      grid-template-rows: 1fr auto;
      grid-template-columns: minmax(0, 1fr);
      min-height: 100dvh;

      @include breakpoints.medium-and-up {
        --layout-page-height: 100dvh;

        grid-template-areas: 'navigation content';
        grid-template-rows: 1fr;
        grid-template-columns: auto minmax(0, 1fr);
      }
    }

    .shell__navigation {
      position: sticky;
      bottom: 0;
      z-index: var(--layer-chrome);
      grid-area: navigation;

      @include breakpoints.medium-and-up {
        top: 0;
        bottom: auto;
        align-self: start;
        height: 100dvh;
      }
    }

    .shell__content {
      display: flex;
      grid-area: content;
      flex-direction: column;
      padding-right: var(--safe-area-right);
      padding-left: var(--safe-area-left);

      @include breakpoints.medium-and-up {
        padding-left: 0;
      }

      // Focus target of the skip link only; it is not interactive itself.
      &:focus {
        outline: none;
      }
    }

    // Above the bottom navigation (and the sheet over it) on phones, at the bottom from the
    // medium breakpoint on, where the navigation is a rail.
    .shell__notices {
      position: fixed;
      right: calc(var(--safe-area-right) + var(--space-md));
      bottom: calc(var(--layout-navigation-height) + var(--safe-area-bottom) + var(--space-sm));
      left: calc(var(--safe-area-left) + var(--space-md));
      z-index: var(--layer-notice);
      display: flex;
      justify-content: center;
      // The empty region spans the width; only the notice itself takes taps.
      pointer-events: none;

      @include breakpoints.medium-and-up {
        bottom: calc(var(--safe-area-bottom) + var(--space-md));
        left: calc(var(--layout-rail-width) + var(--safe-area-left) + var(--space-md));
      }
    }

    .shell__update {
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
      width: 100%;
      max-width: var(--layout-search-width-maximum);
      padding-inline-end: var(--space-sm);
      pointer-events: auto;
    }

    // Zero specificity, so a page can override this on its own host.
    :where(.shell__content > router-outlet + *) {
      display: flex;
      flex: 1 0 auto;
      flex-direction: column;
    }
  `,
})
export class App {
  private readonly applicationUpdate = inject(ApplicationUpdateStore);
  protected readonly isUpdateReady = this.applicationUpdate.isUpdateReady;

  protected reloadApplication(): void {
    void this.applicationUpdate.reload();
  }

  /**
   * A plain `#fragment` link would resolve against `<base href="/">` and reload the start page,
   * so the skip link moves focus itself; `focus()` also scrolls the content into view.
   */
  protected skipToContent(event: Event, content: HTMLElement): void {
    event.preventDefault();
    content.focus();
  }
}

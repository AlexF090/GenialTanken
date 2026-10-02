import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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

    // Zero specificity, so a page can override this on its own host.
    :where(.shell__content > router-outlet + *) {
      display: flex;
      flex: 1 0 auto;
      flex-direction: column;
    }
  `,
})
export class App {
  /**
   * A plain `#fragment` link would resolve against `<base href="/">` and reload the start page,
   * so the skip link moves focus itself; `focus()` also scrolls the content into view.
   */
  protected skipToContent(event: Event, content: HTMLElement): void {
    event.preventDefault();
    content.focus();
  }
}

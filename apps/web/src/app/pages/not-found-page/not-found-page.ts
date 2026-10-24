import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APPLICATION_NAME } from '../../core/application-name';
import { MAIN_CONTENT_IDENTIFIER } from '../../core/navigation/main-content';
import { PageHeader } from '../../ui/page-header/page-header';

/** Unknown URLs: a page of its own with the way back to the map, the only other page. */
@Component({
  selector: 'app-not-found-page',
  imports: [PageHeader, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="applicationName" />
    <main class="page-content not-found" tabindex="-1" [id]="mainContentIdentifier">
      <h2 class="not-found__board">
        <span class="visually-hidden">Fehler </span>
        <span class="not-found__code">404</span>
      </h2>
      <p class="not-found__message">Diese Seite existiert nicht</p>
      <a class="button" routerLink="/">Zur Karte</a>
    </main>
  `,
  styles: `
    @use 'typography';

    // A page of its own without the map: the grouped background behind the content, which keeps
    // clear of the rounded corners and the home indicator.
    :host {
      min-height: 100dvh;
      padding-inline: var(--safe-area-left) var(--safe-area-right);
      padding-block-end: var(--safe-area-bottom);
      background-color: var(--color-canvas);
    }

    .not-found {
      align-items: flex-start;
      gap: var(--space-lg);
      padding-top: var(--space-2xl);
    }

    // The status code set like a price on a fuel price board
    .not-found__board {
      display: inline-flex;
      padding: var(--space-md) var(--space-lg);
      border-radius: var(--radius-sm);
      background-color: var(--color-surface);
      color: var(--color-text);
      box-shadow: var(--shadow-floating);
    }

    .not-found__code {
      @include typography.price-numerals(var(--font-size-price-hero));
    }

    .not-found__message {
      font-size: var(--font-size-title-2);
      font-weight: var(--font-weight-medium);
    }
  `,
})
export class NotFoundPage {
  protected readonly applicationName = APPLICATION_NAME;
  protected readonly mainContentIdentifier = MAIN_CONTENT_IDENTIFIER;
}

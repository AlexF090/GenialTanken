import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from '../../ui/page-header/page-header';

@Component({
  selector: 'app-not-found-page',
  imports: [PageHeader, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="GenialTanken" />
    <main class="page-content not-found">
      <h2 class="not-found__board">
        <span class="visually-hidden">ERROR </span>
        <span class="not-found__code">404</span>
      </h2>
      <p class="not-found__message">Diese Seite existiert nicht</p>
      <a class="button" routerLink="/">Zur Startseite</a>
    </main>
  `,
  styles: `
    @use 'typography';

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
      background-color: var(--color-chrome);
      color: var(--color-on-chrome);
    }

    .not-found__code {
      @include typography.price-numerals(var(--font-size-price-hero));
    }

    .not-found__message {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-medium);
    }
  `,
})
export class NotFoundPage {}

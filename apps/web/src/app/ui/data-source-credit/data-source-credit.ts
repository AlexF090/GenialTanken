import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ExternalLink } from '../external-link/external-link';

/**
 * Attribution of the French open data (Licence Ouverte 2.0), required wherever its prices show.
 * The settings page explains the data source in full.
 */
@Component({
  selector: 'app-data-source-credit',
  imports: [ExternalLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="data-source-credit">
      <app-external-link href="https://www.prix-carburants.gouv.fr/"
        >Preisdaten: prix-carburants.gouv.fr</app-external-link
      >
    </p>
  `,
  styles: `
    :host {
      display: block;
    }

    .data-source-credit {
      color: var(--color-text-secondary);
      font-size: var(--font-size-xs);
    }
  `,
})
export class DataSourceCredit {}

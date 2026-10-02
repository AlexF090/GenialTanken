import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Attribution of the French open data (Licence Ouverte 2.0), required wherever its prices show.
 * The settings page explains the data source in full.
 */
@Component({
  selector: 'app-data-source-credit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="data-source-credit">
      <a href="https://www.prix-carburants.gouv.fr/" target="_blank" rel="noopener noreferrer"
        >Preisdaten: prix-carburants.gouv.fr<span class="visually-hidden">
          (öffnet in neuem Tab)</span
        ></a
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

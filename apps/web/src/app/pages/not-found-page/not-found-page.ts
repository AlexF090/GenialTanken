import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FUEL_TYPE_LABELS } from '../../core/fuel-type-labels';
import { SettingsStore } from '../../core/settings/settings-store';
import { PageHeader } from '../../ui/page-header/page-header';

@Component({
  selector: 'app-not-found-page',
  imports: [PageHeader, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="GenialTanken" [fuelLabel]="fuelLabel()" />
    <main class="page-content not-found">
      <h2>ERROR 404</h2>
      <p>Diese Seite existiert nicht</p>
      <a routerLink="/">Zur Startseite</a>
    </main>
  `,
  styles: `
    .not-found {
      align-items: center;
      text-align: center;
    }
  `,
})
export class NotFoundPage {
  private readonly fuelType = inject(SettingsStore).fuelType;

  protected readonly fuelLabel = computed(() => FUEL_TYPE_LABELS[this.fuelType()].short);
}

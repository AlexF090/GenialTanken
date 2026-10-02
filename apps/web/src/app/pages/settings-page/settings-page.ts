import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { form, FormField, max, min } from '@angular/forms/signals';
import {
  FUEL_TYPES,
  MAXIMUM_RADIUS_IN_KILOMETERS,
  MINIMUM_RADIUS_IN_KILOMETERS,
} from '@genialtanken/contracts';
import { FUEL_TYPE_LABELS } from '../../core/fuel-type-labels';
import { SettingsStore } from '../../core/settings/settings-store';
import type { Settings } from '../../core/settings/settings-store';
import { PageHeader } from '../../ui/page-header/page-header';

/** Changes apply immediately and persist; there is nothing to submit. */
@Component({
  selector: 'app-settings-page',
  imports: [PageHeader, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  private readonly settingsStore = inject(SettingsStore);

  protected readonly fuelTypeOptions = FUEL_TYPES.map(fuelType => ({
    value: fuelType,
    label: FUEL_TYPE_LABELS[fuelType].short,
  }));
  protected readonly minimumRadiusInKilometers = MINIMUM_RADIUS_IN_KILOMETERS;
  protected readonly maximumRadiusInKilometers = MAXIMUM_RADIUS_IN_KILOMETERS;

  protected readonly settingsModel = signal<Settings>({ ...this.settingsStore.settings() });
  protected readonly settingsForm = form(this.settingsModel, settings => {
    min(settings.radiusInKilometers, MINIMUM_RADIUS_IN_KILOMETERS);
    max(settings.radiusInKilometers, MAXIMUM_RADIUS_IN_KILOMETERS);
  });
  protected readonly fuelLabel = computed(
    () => FUEL_TYPE_LABELS[this.settingsStore.fuelType()].short
  );

  constructor() {
    effect(() => {
      const settings = this.settingsModel();
      if (this.settingsForm().valid()) {
        this.settingsStore.update(settings);
      }
    });
  }
}

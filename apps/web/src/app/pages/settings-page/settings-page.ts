import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { form, FormField, max, min } from '@angular/forms/signals';
import {
  COLOR_SCHEME_PREFERENCES,
  FUEL_TYPES,
  MAXIMUM_RADIUS_IN_KILOMETERS,
  MINIMUM_RADIUS_IN_KILOMETERS,
} from '@genialtanken/contracts';
import type { ColorSchemePreference } from '@genialtanken/contracts';
import { FUEL_TYPE_LABELS } from '../../core/fuel-type-labels';
import { SettingsStore } from '../../core/settings/settings-store';
import type { Settings } from '../../core/settings/settings-store';
import { PageHeader } from '../../ui/page-header/page-header';

type SearchSettings = Pick<Settings, 'fuelType' | 'radiusInKilometers'>;

const COLOR_SCHEME_LABELS: Record<ColorSchemePreference, string> = {
  system: 'System',
  light: 'Hell',
  dark: 'Dunkel',
};

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
  protected readonly colorSchemeOptions = COLOR_SCHEME_PREFERENCES.map(colorScheme => ({
    value: colorScheme,
    label: COLOR_SCHEME_LABELS[colorScheme],
  }));
  protected readonly minimumRadiusInKilometers = MINIMUM_RADIUS_IN_KILOMETERS;
  protected readonly maximumRadiusInKilometers = MAXIMUM_RADIUS_IN_KILOMETERS;
  protected readonly colorScheme = this.settingsStore.colorScheme;

  /** Only the fields of this form, so writing it back never overwrites other settings. */
  protected readonly searchSettingsModel = signal<SearchSettings>({
    fuelType: this.settingsStore.fuelType(),
    radiusInKilometers: this.settingsStore.radiusInKilometers(),
  });
  protected readonly searchSettingsForm = form(this.searchSettingsModel, settings => {
    min(settings.radiusInKilometers, MINIMUM_RADIUS_IN_KILOMETERS);
    max(settings.radiusInKilometers, MAXIMUM_RADIUS_IN_KILOMETERS);
  });

  constructor() {
    effect(() => {
      const { fuelType, radiusInKilometers } = this.searchSettingsModel();
      if (this.searchSettingsForm().valid()) {
        this.settingsStore.update({ fuelType, radiusInKilometers });
      }
    });
  }

  protected selectColorScheme(colorScheme: ColorSchemePreference): void {
    this.settingsStore.update({ colorScheme });
  }
}

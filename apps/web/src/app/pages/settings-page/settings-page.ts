import { KilometersPipe } from '../../core/formatting/kilometers-pipe';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { form, FormField, max, min } from '@angular/forms/signals';
import {
  COLOR_SCHEME_PREFERENCES,
  MAXIMUM_RADIUS_IN_KILOMETERS,
  MINIMUM_RADIUS_IN_KILOMETERS,
} from '@genialtanken/contracts';
import type { ColorSchemePreference } from '@genialtanken/contracts';
import { ApplicationUpdateStore } from '../../core/application-update/application-update-store';
import { uniqueIdentifier } from '../../core/dom/unique-identifier';
import { injectCloseToExplore } from '../../core/navigation/close-to-explore';
import { fuelTypeOptions } from '../../core/fuel-type-labels';
import type { LabeledOption } from '../../core/labeled-option';
import { SettingsStore } from '../../core/settings/settings-store';
import type { Settings } from '../../core/settings/settings-store';
import { Icon } from '../../ui/icon/icon';
import { ExternalLink } from '../../ui/external-link/external-link';
import { SheetDialog } from '../../ui/sheet-dialog/sheet-dialog';
import { UpdateNotice } from '../../ui/update-notice/update-notice';
import { Wordmark } from '../../ui/wordmark/wordmark';

type SearchSettings = Pick<Settings, 'fuelType' | 'radiusInKilometers'>;

const COLOR_SCHEME_LABELS: Record<ColorSchemePreference, string> = {
  system: 'System',
  light: 'Hell',
  dark: 'Dunkel',
};

/**
 * A modal sheet over the explore page, so map and list stay where they were. Changes apply
 * immediately and persist; there is nothing to submit. Closing returns to the list.
 */
@Component({
  selector: 'app-settings-page',
  imports: [SheetDialog, FormField, Icon, KilometersPipe, ExternalLink, UpdateNotice, Wordmark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  private readonly settingsStore = inject(SettingsStore);
  private readonly closeToExplore = injectCloseToExplore();
  private readonly applicationUpdate = inject(ApplicationUpdateStore);
  protected readonly pendingReload = this.applicationUpdate.pendingReload;

  protected readonly fuelTypeOptions = fuelTypeOptions('short');
  protected readonly colorSchemeOptions: readonly LabeledOption<ColorSchemePreference>[] =
    COLOR_SCHEME_PREFERENCES.map(colorScheme => ({
      value: colorScheme,
      label: COLOR_SCHEME_LABELS[colorScheme],
    }));
  protected readonly radiusIdentifier = uniqueIdentifier('radius');
  protected readonly dataSourceHeadingIdentifier = uniqueIdentifier('data-source-heading');
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

  protected reloadApplication(): void {
    void this.applicationUpdate.reload();
  }

  protected close(): void {
    this.closeToExplore();
  }

  protected selectColorScheme(colorScheme: ColorSchemePreference): void {
    this.settingsStore.update({ colorScheme });
  }
}

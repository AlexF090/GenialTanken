import { computed, inject, Injectable, signal } from '@angular/core';
import {
  colorSchemePreferenceSchema,
  DEFAULT_COLOR_SCHEME_PREFERENCE,
  DEFAULT_FUEL_TYPE,
  DEFAULT_RADIUS_IN_KILOMETERS,
  fuelTypeSchema,
  MAXIMUM_RADIUS_IN_KILOMETERS,
  MINIMUM_RADIUS_IN_KILOMETERS,
  stationsQuerySchema,
} from '@genialtanken/contracts';
import type { ColorSchemePreference, FuelType } from '@genialtanken/contracts';
import { BROWSER_STORAGE } from '../browser-storage';
import { Logger } from '../logging/logger';

export interface Settings {
  fuelType: FuelType;
  radiusInKilometers: number;
  colorScheme: ColorSchemePreference;
}

/** The inline script in `index.html` reads the color scheme from it before Angular starts. */
export const SETTINGS_STORAGE_KEY = 'genialtanken.settings';

const DEFAULT_SETTINGS: Settings = {
  fuelType: DEFAULT_FUEL_TYPE,
  radiusInKilometers: DEFAULT_RADIUS_IN_KILOMETERS,
  colorScheme: DEFAULT_COLOR_SCHEME_PREFERENCE,
};

const clampRadius = (radiusInKilometers: number): number =>
  Math.min(
    MAXIMUM_RADIUS_IN_KILOMETERS,
    Math.max(MINIMUM_RADIUS_IN_KILOMETERS, Math.round(radiusInKilometers))
  );

/**
 * Shape of the persisted settings, built from the API contract so stored values follow the same
 * rules as requests. Each field falls back to its default on its own, so one outdated value
 * (e.g. a removed fuel type) does not reset the other. The object schema is derived from
 * `stationsQuerySchema` because the web app has no direct zod dependency. A factory, because the
 * fallbacks warn through the injected logger.
 */
const createStoredSettingsSchema = (logger: Logger) =>
  stationsQuerySchema.pick({ radiusInKilometers: true }).extend({
    fuelType: fuelTypeSchema.catch(({ value }) => {
      logger.warn(
        `Stored fuel type ${JSON.stringify(value)} is not supported; using the default "${DEFAULT_FUEL_TYPE}" instead.`
      );
      return DEFAULT_FUEL_TYPE;
    }),
    radiusInKilometers: stationsQuerySchema.shape.radiusInKilometers.catch(({ value }) => {
      logger.warn(
        `Stored radius ${JSON.stringify(value)} km is not supported; using the default ${String(DEFAULT_RADIUS_IN_KILOMETERS)} km instead.`
      );
      return DEFAULT_RADIUS_IN_KILOMETERS;
    }),
    // `.catch` also covers a missing value, so settings stored before this field existed keep
    // their fuel type and radius.
    colorScheme: colorSchemePreferenceSchema.catch(({ value }) => {
      if (value !== undefined) {
        logger.warn(
          `Stored color scheme ${JSON.stringify(value)} is not supported; using the default "${DEFAULT_COLOR_SCHEME_PREFERENCE}" instead.`
        );
      }
      return DEFAULT_COLOR_SCHEME_PREFERENCE;
    }),
  });

const parseStoredSettings = (serializedSettings: string | null, logger: Logger): Settings => {
  if (serializedSettings === null) {
    return DEFAULT_SETTINGS;
  }
  let storedValue: unknown;
  try {
    storedValue = JSON.parse(serializedSettings);
  } catch (error) {
    logger.warn('Stored settings are not valid JSON; using the default settings instead.', error);
    return DEFAULT_SETTINGS;
  }
  const result = createStoredSettingsSchema(logger).safeParse(storedValue);
  if (!result.success) {
    logger.warn(
      'Stored settings have an unexpected shape; using the default settings instead.',
      result.error
    );
    return DEFAULT_SETTINGS;
  }
  return result.data;
};

/** Fuel type, search radius and color scheme chosen by the user, persisted across reloads. */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly storage = inject(BROWSER_STORAGE);
  private readonly logger = inject(Logger);
  private readonly state = signal<Settings>(
    parseStoredSettings(this.storage.getItem(SETTINGS_STORAGE_KEY), this.logger)
  );

  readonly settings = this.state.asReadonly();
  readonly fuelType = computed(() => this.state().fuelType);
  readonly radiusInKilometers = computed(() => this.state().radiusInKilometers);
  readonly colorScheme = computed(() => this.state().colorScheme);

  /** Applies the given fields and keeps the others, so each settings control stays independent. */
  update(changes: Partial<Settings>): void {
    const currentSettings = this.state();
    const nextSettings: Settings = {
      fuelType: changes.fuelType ?? currentSettings.fuelType,
      radiusInKilometers: clampRadius(
        changes.radiusInKilometers ?? currentSettings.radiusInKilometers
      ),
      colorScheme: changes.colorScheme ?? currentSettings.colorScheme,
    };
    if (
      nextSettings.fuelType === currentSettings.fuelType &&
      nextSettings.radiusInKilometers === currentSettings.radiusInKilometers &&
      nextSettings.colorScheme === currentSettings.colorScheme
    ) {
      return;
    }
    this.state.set(nextSettings);
    try {
      this.storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
    } catch (error) {
      this.logger.warn(
        'Settings could not be saved in the browser storage; they apply to this session only.',
        error
      );
    }
  }
}

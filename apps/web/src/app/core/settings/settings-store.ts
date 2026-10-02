import { computed, inject, Injectable, signal } from '@angular/core';
import {
  DEFAULT_FUEL_TYPE,
  DEFAULT_RADIUS_IN_KILOMETERS,
  fuelTypeSchema,
  MAXIMUM_RADIUS_IN_KILOMETERS,
  MINIMUM_RADIUS_IN_KILOMETERS,
  stationsQuerySchema,
} from '@genialtanken/contracts';
import type { FuelType } from '@genialtanken/contracts';
import { BROWSER_STORAGE } from '../browser-storage';

export interface Settings {
  fuelType: FuelType;
  radiusInKilometers: number;
}

const SETTINGS_STORAGE_KEY = 'genialtanken.settings';

const DEFAULT_SETTINGS: Settings = {
  fuelType: DEFAULT_FUEL_TYPE,
  radiusInKilometers: DEFAULT_RADIUS_IN_KILOMETERS,
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
 * `stationsQuerySchema` because the web app has no direct zod dependency.
 */
const storedSettingsSchema = stationsQuerySchema.pick({ radiusInKilometers: true }).extend({
  fuelType: fuelTypeSchema.catch(({ value }) => {
    console.warn(
      `Stored fuel type ${JSON.stringify(value)} is not supported; using the default "${DEFAULT_FUEL_TYPE}" instead.`
    );
    return DEFAULT_FUEL_TYPE;
  }),
  radiusInKilometers: stationsQuerySchema.shape.radiusInKilometers.catch(({ value }) => {
    console.warn(
      `Stored radius ${JSON.stringify(value)} km is not supported; using the default ${String(DEFAULT_RADIUS_IN_KILOMETERS)} km instead.`
    );
    return DEFAULT_RADIUS_IN_KILOMETERS;
  }),
});

const parseStoredSettings = (serializedSettings: string | null): Settings => {
  if (serializedSettings === null) {
    return DEFAULT_SETTINGS;
  }
  let storedValue: unknown;
  try {
    storedValue = JSON.parse(serializedSettings);
  } catch (error) {
    console.warn('Stored settings are not valid JSON; using the default settings instead.', error);
    return DEFAULT_SETTINGS;
  }
  const result = storedSettingsSchema.safeParse(storedValue);
  if (!result.success) {
    console.warn(
      'Stored settings have an unexpected shape; using the default settings instead.',
      result.error
    );
    return DEFAULT_SETTINGS;
  }
  return result.data;
};

/** Fuel type and search radius chosen by the user, persisted across reloads. */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly storage = inject(BROWSER_STORAGE);
  private readonly state = signal<Settings>(
    parseStoredSettings(this.storage.getItem(SETTINGS_STORAGE_KEY))
  );

  readonly settings = this.state.asReadonly();
  readonly fuelType = computed(() => this.state().fuelType);
  readonly radiusInKilometers = computed(() => this.state().radiusInKilometers);

  update(settings: Settings): void {
    const nextSettings: Settings = {
      fuelType: settings.fuelType,
      radiusInKilometers: clampRadius(settings.radiusInKilometers),
    };
    const currentSettings = this.state();
    if (
      nextSettings.fuelType === currentSettings.fuelType &&
      nextSettings.radiusInKilometers === currentSettings.radiusInKilometers
    ) {
      return;
    }
    this.state.set(nextSettings);
    try {
      this.storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
    } catch (error) {
      console.warn(
        'Settings could not be saved in the browser storage; they apply to this session only.',
        error
      );
    }
  }
}

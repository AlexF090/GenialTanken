import { computed, inject, Injectable, signal } from '@angular/core';
import {
  DEFAULT_FUEL_TYPE,
  DEFAULT_RADIUS_IN_KILOMETERS,
  fuelTypeSchema,
  MAXIMUM_RADIUS_IN_KILOMETERS,
  MINIMUM_RADIUS_IN_KILOMETERS,
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

const isSupportedRadius = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= MINIMUM_RADIUS_IN_KILOMETERS &&
  value <= MAXIMUM_RADIUS_IN_KILOMETERS;

const clampRadius = (radiusInKilometers: number): number =>
  Math.min(
    MAXIMUM_RADIUS_IN_KILOMETERS,
    Math.max(MINIMUM_RADIUS_IN_KILOMETERS, Math.round(radiusInKilometers))
  );

const parseStoredSettings = (serializedSettings: string | null): Settings => {
  if (serializedSettings === null) {
    return DEFAULT_SETTINGS;
  }
  let storedValue: unknown;
  try {
    storedValue = JSON.parse(serializedSettings);
  } catch (error) {
    console.warn('Ignoring stored settings that are not valid JSON', error);
    return DEFAULT_SETTINGS;
  }
  if (typeof storedValue !== 'object' || storedValue === null) {
    return DEFAULT_SETTINGS;
  }
  const fuelType = fuelTypeSchema.safeParse(Reflect.get(storedValue, 'fuelType'));
  const radiusInKilometers: unknown = Reflect.get(storedValue, 'radiusInKilometers');
  return {
    fuelType: fuelType.success ? fuelType.data : DEFAULT_SETTINGS.fuelType,
    radiusInKilometers: isSupportedRadius(radiusInKilometers)
      ? radiusInKilometers
      : DEFAULT_SETTINGS.radiusInKilometers,
  };
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
      console.warn('Settings could not be persisted; they apply to this session only', error);
    }
  }
}

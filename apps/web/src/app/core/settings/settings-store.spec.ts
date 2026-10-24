import { TestBed } from '@angular/core/testing';
import type { MockInstance } from 'vitest';
import { FakeStorage, storedSettings } from '../../../testing/fake-storage';
import { LOCAL_STORAGE } from '../browser-storage';
import { Logger } from '../logging/logger';
import { SETTINGS_STORAGE_KEY, SettingsStore } from './settings-store';

interface CreatedStore {
  store: SettingsStore;
  warn: MockInstance<Logger['warn']>;
}

/** Spies on the warnings before the store exists, because it reads the storage on creation. */
const createStore = (storage: Storage): CreatedStore => {
  TestBed.configureTestingModule({ providers: [{ provide: LOCAL_STORAGE, useValue: storage }] });
  const warn = vi.spyOn(TestBed.inject(Logger), 'warn').mockImplementation(() => undefined);
  return { store: TestBed.inject(SettingsStore), warn };
};

describe('SettingsStore', () => {
  it('persists under the key the inline script of index.html reads', () => {
    expect(SETTINGS_STORAGE_KEY).toBe('genialtanken.settings');
  });

  it('starts with E5 and a 5 km radius when nothing is stored', () => {
    const { store } = createStore(new FakeStorage());

    expect(store.fuelType()).toBe('e5');
    expect(store.radiusInKilometers()).toBe(5);
  });

  it('restores the stored fuel type and radius', () => {
    const { store } = createStore(
      new FakeStorage({
        [SETTINGS_STORAGE_KEY]: '{"fuelType":"diesel","radiusInKilometers":12}',
      })
    );

    expect(store.fuelType()).toBe('diesel');
    expect(store.radiusInKilometers()).toBe(12);
  });

  it('persists updates so they survive a reload', () => {
    const storage = new FakeStorage();
    const { store } = createStore(storage);

    store.update({ fuelType: 'e10', radiusInKilometers: 20 });

    expect(store.fuelType()).toBe('e10');
    expect(store.radiusInKilometers()).toBe(20);
    expect(storedSettings(storage)).toBe(
      '{"fuelType":"e10","radiusInKilometers":20,"colorScheme":"system"}'
    );
  });

  it('follows the system color scheme when nothing is stored', () => {
    const { store } = createStore(new FakeStorage());

    expect(store.colorScheme()).toBe('system');
  });

  it('restores and persists the color scheme without touching the other settings', () => {
    const storage = new FakeStorage({
      [SETTINGS_STORAGE_KEY]: '{"fuelType":"diesel","radiusInKilometers":12,"colorScheme":"dark"}',
    });
    const { store } = createStore(storage);

    expect(store.colorScheme()).toBe('dark');

    store.update({ colorScheme: 'light' });

    expect(store.settings()).toEqual({
      fuelType: 'diesel',
      radiusInKilometers: 12,
      colorScheme: 'light',
    });
    expect(storedSettings(storage)).toBe(
      '{"fuelType":"diesel","radiusInKilometers":12,"colorScheme":"light"}'
    );
  });

  it('keeps settings stored before the color scheme existed without a warning', () => {
    const { store, warn } = createStore(
      new FakeStorage({ [SETTINGS_STORAGE_KEY]: '{"fuelType":"diesel","radiusInKilometers":12}' })
    );

    expect(warn).not.toHaveBeenCalled();
    expect(store.fuelType()).toBe('diesel');
    expect(store.colorScheme()).toBe('system');
  });

  it('ignores an unknown stored color scheme and keeps the other settings', () => {
    const { store, warn } = createStore(
      new FakeStorage({
        [SETTINGS_STORAGE_KEY]:
          '{"fuelType":"diesel","radiusInKilometers":12,"colorScheme":"sepia"}',
      })
    );

    expect(warn).toHaveBeenCalledExactlyOnceWith(
      'Stored color scheme "sepia" is not supported; using the default "system" instead.'
    );
    expect(store.fuelType()).toBe('diesel');
    expect(store.colorScheme()).toBe('system');
  });

  it('does not write to the storage when nothing changes', () => {
    const storage = new FakeStorage();
    const setItem = vi.spyOn(storage, 'setItem');
    const { store } = createStore(storage);

    store.update({ fuelType: 'e5', radiusInKilometers: 5, colorScheme: 'system' });

    expect(setItem).not.toHaveBeenCalled();
  });

  it('falls back to the defaults for corrupt stored settings and says why', () => {
    const { store, warn } = createStore(new FakeStorage({ [SETTINGS_STORAGE_KEY]: '{not json' }));

    expect(warn).toHaveBeenCalledExactlyOnceWith(
      'Stored settings are not valid JSON; using the default settings instead.',
      expect.any(SyntaxError)
    );
    expect(store.fuelType()).toBe('e5');
    expect(store.radiusInKilometers()).toBe(5);
  });

  it('falls back to the defaults when the stored settings are not an object', () => {
    const { store, warn } = createStore(new FakeStorage({ [SETTINGS_STORAGE_KEY]: '[1,2]' }));

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toBe(
      'Stored settings have an unexpected shape; using the default settings instead.'
    );
    expect(store.fuelType()).toBe('e5');
    expect(store.radiusInKilometers()).toBe(5);
  });

  it('ignores an unknown fuel type and an out-of-range radius', () => {
    const { store, warn } = createStore(
      new FakeStorage({
        [SETTINGS_STORAGE_KEY]: '{"fuelType":"kerosene","radiusInKilometers":80}',
      })
    );

    expect(store.fuelType()).toBe('e5');
    expect(store.radiusInKilometers()).toBe(5);
    expect(warn.mock.calls.map((call: unknown[]) => call[0]).sort()).toEqual([
      'Stored fuel type "kerosene" is not supported; using the default "e5" instead.',
      'Stored radius 80 km is not supported; using the default 5 km instead.',
    ]);
  });

  it('keeps the valid part of partially invalid stored settings', () => {
    const { store } = createStore(
      new FakeStorage({
        [SETTINGS_STORAGE_KEY]: '{"fuelType":"diesel","radiusInKilometers":"far"}',
      })
    );

    expect(store.fuelType()).toBe('diesel');
    expect(store.radiusInKilometers()).toBe(5);
  });

  it('keeps the settings for this session and warns when the storage refuses to write', () => {
    const storage = new FakeStorage();
    const quotaExceeded = new DOMException('Storage is full', 'QuotaExceededError');
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw quotaExceeded;
    });
    const { store, warn } = createStore(storage);

    store.update({ fuelType: 'diesel' });

    expect(store.fuelType()).toBe('diesel');
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      'Settings could not be saved in the browser storage; they apply to this session only.',
      quotaExceeded
    );
  });

  it('clamps an updated radius to the supported range', () => {
    const { store } = createStore(new FakeStorage());

    store.update({ fuelType: 'e5', radiusInKilometers: 40 });

    expect(store.radiusInKilometers()).toBe(30);
  });
});

import { TestBed } from '@angular/core/testing';
import { FakeStorage } from '../../../testing/fake-storage';
import { BROWSER_STORAGE } from '../browser-storage';
import { SettingsStore } from './settings-store';

const createStore = (storage: Storage): SettingsStore => {
  TestBed.configureTestingModule({ providers: [{ provide: BROWSER_STORAGE, useValue: storage }] });
  return TestBed.inject(SettingsStore);
};

describe('SettingsStore', () => {
  it('starts with E5 and a 5 km radius when nothing is stored', () => {
    const store = createStore(new FakeStorage());

    expect(store.fuelType()).toBe('e5');
    expect(store.radiusInKilometers()).toBe(5);
  });

  it('restores the stored fuel type and radius', () => {
    const store = createStore(
      new FakeStorage({
        'genialtanken.settings': '{"fuelType":"diesel","radiusInKilometers":12}',
      })
    );

    expect(store.fuelType()).toBe('diesel');
    expect(store.radiusInKilometers()).toBe(12);
  });

  it('persists updates so they survive a reload', () => {
    const storage = new FakeStorage();
    const store = createStore(storage);

    store.update({ fuelType: 'e10', radiusInKilometers: 20 });

    expect(store.fuelType()).toBe('e10');
    expect(store.radiusInKilometers()).toBe(20);
    expect(storage.getItem('genialtanken.settings')).toBe(
      '{"fuelType":"e10","radiusInKilometers":20}'
    );
  });

  it('falls back to the defaults for corrupt stored settings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const store = createStore(new FakeStorage({ 'genialtanken.settings': '{not json' }));

    expect(warn).toHaveBeenCalledOnce();
    expect(store.fuelType()).toBe('e5');
    expect(store.radiusInKilometers()).toBe(5);
  });

  it('ignores an unknown fuel type and an out-of-range radius', () => {
    const store = createStore(
      new FakeStorage({
        'genialtanken.settings': '{"fuelType":"kerosene","radiusInKilometers":80}',
      })
    );

    expect(store.fuelType()).toBe('e5');
    expect(store.radiusInKilometers()).toBe(5);
  });

  it('clamps an updated radius to the supported range', () => {
    const store = createStore(new FakeStorage());

    store.update({ fuelType: 'e5', radiusInKilometers: 40 });

    expect(store.radiusInKilometers()).toBe(25);
  });
});

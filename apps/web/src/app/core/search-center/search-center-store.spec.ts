import { computed } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FakeGeolocation } from '../../../testing/fake-geolocation';
import { bastillePlace, lyonPlace } from '../../../testing/place-fixtures';
import { GEOLOCATION } from '../geolocation/geolocation-service';
import { DEFAULT_SEARCH_CENTER } from './search-center';
import { SearchCenterStore } from './search-center-store';

const PERMISSION_DENIED_MESSAGE =
  'Der Zugriff auf deinen Standort wurde verweigert. Erlaube ihn in den Einstellungen deines Browsers, um Tankstellen in deiner Nähe zu sehen.';

describe('SearchCenterStore', () => {
  let geolocation: FakeGeolocation;
  let store: SearchCenterStore;

  beforeEach(() => {
    geolocation = new FakeGeolocation();
    TestBed.configureTestingModule({
      providers: [{ provide: GEOLOCATION, useValue: geolocation }],
    });
    store = TestBed.inject(SearchCenterStore);
  });

  it('starts at the Eiffel Tower without asking for the position', () => {
    expect(store.center()).toEqual({
      latitude: 48.8584,
      longitude: 2.2945,
      label: 'Eiffelturm, Paris',
      source: 'default',
    });
    expect(geolocation.pendingRequestCount).toBe(0);
    expect(store.isLocating()).toBe(false);
    expect(store.locationErrorMessage()).toBeUndefined();
  });

  it('moves to a chosen place', () => {
    store.usePlace(bastillePlace);

    expect(store.center()).toEqual({
      latitude: 48.8532,
      longitude: 2.3692,
      label: 'Place de la Bastille',
      source: 'place',
    });
  });

  it('moves to the own position once the browser reports it', async () => {
    const located = store.useOwnPosition();
    expect(store.isLocating()).toBe(true);
    expect(store.center()).toEqual(DEFAULT_SEARCH_CENTER);

    geolocation.resolvePosition(51.3127, 9.4797);
    await located;

    expect(store.isLocating()).toBe(false);
    expect(store.center()).toEqual({
      latitude: 51.3127,
      longitude: 9.4797,
      label: 'Dein Standort',
      source: 'own-position',
    });
  });

  it('keeps the previous center and explains why when locating fails', async () => {
    store.usePlace(lyonPlace);

    const located = store.useOwnPosition();
    geolocation.rejectWithPermissionDenied();
    await located;

    expect(store.center().label).toBe('Lyon');
    expect(store.locationErrorMessage()).toBe(PERMISSION_DENIED_MESSAGE);
  });

  it('keeps the center when locating fails after an earlier success', async () => {
    const firstLocation = store.useOwnPosition();
    geolocation.resolvePosition(51.3127, 9.4797);
    await firstLocation;
    store.usePlace(bastillePlace);

    const secondLocation = store.useOwnPosition();
    geolocation.rejectWithTimeout();
    await secondLocation;

    expect(store.center().label).toBe('Place de la Bastille');
  });

  it('hides a location error once another center is chosen', async () => {
    const located = store.useOwnPosition();
    geolocation.rejectWithPermissionDenied();
    await located;

    store.usePlace(bastillePlace);

    expect(store.locationErrorMessage()).toBeUndefined();
  });

  it('hides a dismissed location error until locating fails again', async () => {
    const located = store.useOwnPosition();
    geolocation.rejectWithPermissionDenied();
    await located;

    store.dismissLocationError();
    expect(store.locationErrorMessage()).toBeUndefined();

    const locatedAgain = store.useOwnPosition();
    geolocation.rejectWithPermissionDenied();
    await locatedAgain;
    expect(store.locationErrorMessage()).toBe(PERMISSION_DENIED_MESSAGE);
  });

  it('lets a place chosen while locating win over the late position', async () => {
    const located = store.useOwnPosition();
    store.usePlace(bastillePlace);

    geolocation.resolvePosition(51.3127, 9.4797);
    await located;

    expect(store.center().label).toBe('Place de la Bastille');
  });

  it('moves to the area the map was moved to', () => {
    store.useMapArea({ latitude: 48.87, longitude: 2.33 });

    expect(store.center()).toEqual({
      latitude: 48.87,
      longitude: 2.33,
      label: 'Kartenmitte',
      source: 'map-area',
    });
  });

  it('lets a map area chosen while locating win over the late position', async () => {
    const located = store.useOwnPosition();
    store.useMapArea({ latitude: 48.87, longitude: 2.33 });

    geolocation.resolvePosition(51.3127, 9.4797);
    await located;

    expect(store.center().source).toBe('map-area');
  });

  it('moves to a station opened from elsewhere, named after it', () => {
    store.useStation({ latitude: 48.89, longitude: 2.39, label: 'TotalEnergies' });

    expect(store.center()).toEqual({
      latitude: 48.89,
      longitude: 2.39,
      label: 'TotalEnergies',
      source: 'station',
    });
  });

  it('returns to the Eiffel Tower on reset', () => {
    store.usePlace(lyonPlace);

    store.resetToDefault();

    expect(store.center()).toEqual(DEFAULT_SEARCH_CENTER);
  });

  it('does not notify dependents when the same center is set again', () => {
    let computations = 0;
    const dependent = computed(() => {
      computations += 1;
      return store.center();
    });
    store.usePlace(bastillePlace);
    dependent();

    store.usePlace({ ...bastillePlace });
    dependent();

    expect(computations).toBe(1);
  });
});

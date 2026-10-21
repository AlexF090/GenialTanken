import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Station } from '@genialtanken/contracts';
import { FakeGeolocation } from '../../../testing/fake-geolocation';
import { FakeStorage } from '../../../testing/fake-storage';
import { bastillePlace } from '../../../testing/place-fixtures';
import {
  carrefourStation,
  totalStation,
  unbrandedStation,
} from '../../../testing/station-fixtures';
import { BROWSER_STORAGE } from '../browser-storage';
import { GEOLOCATION } from '../geolocation/geolocation-service';
import { SearchCenterStore } from '../search-center/search-center-store';
import { SettingsStore } from '../settings/settings-store';
import { NearbyStationsStore } from './nearby-stations-store';

const EIFFEL_TOWER_E5_URL =
  '/api/stations?latitude=48.8584&longitude=2.2945&radiusInKilometers=5&fuel=e5';
const BASTILLE_E5_URL =
  '/api/stations?latitude=48.8532&longitude=2.3692&radiusInKilometers=5&fuel=e5';

describe('NearbyStationsStore', () => {
  let geolocation: FakeGeolocation;
  let httpTesting: HttpTestingController;
  let store: NearbyStationsStore;
  let searchCenter: SearchCenterStore;

  const settle = async (): Promise<void> => {
    TestBed.tick();
    await new Promise(resolve => setTimeout(resolve));
    TestBed.tick();
  };

  const loadAtEiffelTower = async (stations: Station[] = [totalStation, carrefourStation]) => {
    TestBed.tick();
    httpTesting.expectOne(EIFFEL_TOWER_E5_URL).flush(stations);
    await settle();
  };

  beforeEach(() => {
    geolocation = new FakeGeolocation();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BROWSER_STORAGE, useValue: new FakeStorage() },
        { provide: GEOLOCATION, useValue: geolocation },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    store = TestBed.inject(NearbyStationsStore);
    searchCenter = TestBed.inject(SearchCenterStore);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads the stations around the Eiffel Tower right away without locating', async () => {
    expect(store.hasLoaded()).toBe(false);

    await loadAtEiffelTower();

    expect(geolocation.pendingRequestCount).toBe(0);
    expect(store.hasLoaded()).toBe(true);
    expect(store.isLoading()).toBe(false);
    expect(store.stations()).toEqual([totalStation, carrefourStation]);
  });

  it('loads again for a new search center, fuel type or radius', async () => {
    await loadAtEiffelTower();

    searchCenter.usePlace(bastillePlace);
    TestBed.tick();
    httpTesting.expectOne(BASTILLE_E5_URL).flush([carrefourStation]);
    await settle();
    expect(store.stations()).toEqual([carrefourStation]);

    TestBed.inject(SettingsStore).update({ fuelType: 'diesel', radiusInKilometers: 10 });
    TestBed.tick();
    httpTesting
      .expectOne(
        '/api/stations?latitude=48.8532&longitude=2.3692&radiusInKilometers=10&fuel=diesel'
      )
      .flush([]);
    await settle();
    expect(store.stations()).toEqual([]);
  });

  it('does not load again when the same place is chosen twice', async () => {
    searchCenter.usePlace(bastillePlace);
    TestBed.tick();
    httpTesting.expectOne(BASTILLE_E5_URL).flush([carrefourStation]);
    await settle();

    searchCenter.usePlace({ ...bastillePlace });
    await settle();

    httpTesting.expectNone(() => true);
  });

  it('does not load again when only the label of the center changes', async () => {
    searchCenter.usePlace(bastillePlace);
    TestBed.tick();
    httpTesting.expectOne(BASTILLE_E5_URL).flush([carrefourStation]);
    await settle();

    searchCenter.usePlace({ ...bastillePlace, name: 'Bastille' });
    await settle();

    httpTesting.expectNone(() => true);
  });

  it('loads around the own position after locating and counts locating as loading', async () => {
    await loadAtEiffelTower();

    const located = searchCenter.useOwnPosition();
    expect(store.isLoading()).toBe(true);
    geolocation.resolvePosition(51.3127, 9.4797);
    await located;
    TestBed.tick();

    httpTesting
      .expectOne('/api/stations?latitude=51.3127&longitude=9.4797&radiusInKilometers=5&fuel=e5')
      .flush([]);
    await settle();
    expect(store.isLoading()).toBe(false);
  });

  it('reloads the same search on refresh', async () => {
    await loadAtEiffelTower();

    store.refresh();
    TestBed.tick();

    httpTesting.expectOne(EIFFEL_TOWER_E5_URL).flush([unbrandedStation]);
    await settle();
    expect(store.stations()).toEqual([unbrandedStation]);
  });

  it('marks every station tied at the lowest price of the selected fuel type', async () => {
    expect(store.cheapestStationIdentifiers().size).toBe(0);

    await loadAtEiffelTower([
      totalStation,
      { ...carrefourStation, pricesInEuro: { ...carrefourStation.pricesInEuro, e5: 1.799 } },
      unbrandedStation,
    ]);

    expect([...store.cheapestStationIdentifiers()]).toEqual([
      carrefourStation.id,
      unbrandedStation.id,
    ]);
  });

  it('describes a failed request', async () => {
    TestBed.tick();
    httpTesting
      .expectOne(EIFFEL_TOWER_E5_URL)
      .flush(
        { statusCode: 502, message: 'Upstream unavailable' },
        { status: 502, statusText: 'Bad Gateway' }
      );
    await settle();

    expect(store.errorMessage()).toBe(
      'Die Preisdaten sind gerade nicht erreichbar. Bitte versuche es später erneut.'
    );
    expect(store.stations()).toEqual([]);
  });
});

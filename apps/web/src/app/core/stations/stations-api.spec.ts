import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { carrefourStation, totalStation, withoutDistance } from '../../../testing/station-fixtures';
import { StationsApi } from './stations-api';
import type { StationsSearch } from './stations-api';
import { UnexpectedResponseError } from '../http/unexpected-response-error';

const PARIS_SEARCH: StationsSearch = {
  latitude: 48.8566,
  longitude: 2.3522,
  radiusInKilometers: 5,
  fuelType: 'e5',
};

const NOT_FOUND = { status: 404, statusText: 'Not Found' };
const NOT_FOUND_BODY = { statusCode: 404, message: 'Station not found' };

describe('StationsApi', () => {
  let stationsApi: StationsApi;
  let httpTesting: HttpTestingController;
  let injector: Injector;

  const settle = (): Promise<void> => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    stationsApi = TestBed.inject(StationsApi);
    httpTesting = TestBed.inject(HttpTestingController);
    injector = TestBed.inject(Injector);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  describe('stationsAround', () => {
    it('requests the stations for position, radius and fuel type', async () => {
      const stations = runInInjectionContext(injector, () =>
        stationsApi.stationsAround(() => PARIS_SEARCH)
      );
      TestBed.tick();

      httpTesting
        .expectOne('/api/stations?latitude=48.8566&longitude=2.3522&radiusInKilometers=5&fuel=e5')
        .flush([totalStation, carrefourStation]);
      await settle();

      expect(stations.value()).toEqual([totalStation, carrefourStation]);
    });

    it('sends no request while the search is unknown', () => {
      const stations = runInInjectionContext(injector, () =>
        stationsApi.stationsAround(() => undefined)
      );
      TestBed.tick();

      httpTesting.expectNone(() => true);
      expect(stations.status()).toBe('idle');
    });

    it('requests again when the fuel type or radius changes', async () => {
      const search = signal<StationsSearch>(PARIS_SEARCH);
      const stations = runInInjectionContext(injector, () =>
        stationsApi.stationsAround(() => search())
      );
      TestBed.tick();
      httpTesting.expectOne(request => request.params.get('fuel') === 'e5').flush([totalStation]);
      await settle();

      search.set({ ...PARIS_SEARCH, fuelType: 'superPlus', radiusInKilometers: 10 });
      TestBed.tick();

      httpTesting
        .expectOne(
          '/api/stations?latitude=48.8566&longitude=2.3522&radiusInKilometers=10&fuel=superPlus'
        )
        .flush([carrefourStation]);
      await settle();
      expect(stations.value()).toEqual([carrefourStation]);
    });

    it('fails with an UnexpectedResponseError when the body violates the contract', async () => {
      const stations = runInInjectionContext(injector, () =>
        stationsApi.stationsAround(() => PARIS_SEARCH)
      );
      TestBed.tick();

      httpTesting.expectOne(() => true).flush([{ id: 'fr-1' }]);
      await settle();

      expect(stations.status()).toBe('error');
      expect(stations.error()).toBeInstanceOf(UnexpectedResponseError);
    });
  });

  describe('stationByIdentifier', () => {
    it('requests a single station by its URL-encoded id', async () => {
      const station = runInInjectionContext(injector, () =>
        stationsApi.stationByIdentifier(() => 'fr/75 001')
      );
      TestBed.tick();

      httpTesting.expectOne('/api/stations/fr%2F75%20001').flush(withoutDistance(totalStation));
      await settle();

      expect(station.value()).toEqual(withoutDistance(totalStation));
    });

    it('exposes the 404 of an unknown station as error', async () => {
      const station = runInInjectionContext(injector, () =>
        stationsApi.stationByIdentifier(() => 'unknown-station')
      );
      TestBed.tick();

      httpTesting.expectOne('/api/stations/unknown-station').flush(NOT_FOUND_BODY, NOT_FOUND);
      await settle();

      const error = station.error();
      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect(error instanceof HttpErrorResponse ? error.status : undefined).toBe(404);
    });
  });

  describe('loadStationsByIdentifiers', () => {
    it('loads every station and reports unavailable ids separately', async () => {
      const result = stationsApi.loadStationsByIdentifiers([
        'fr-75001001',
        'de-unavailable',
        'fr-75005002',
      ]);

      httpTesting.expectOne('/api/stations/fr-75001001').flush(withoutDistance(totalStation));
      httpTesting.expectOne('/api/stations/de-unavailable').flush(NOT_FOUND_BODY, NOT_FOUND);
      httpTesting.expectOne('/api/stations/fr-75005002').flush(withoutDistance(carrefourStation));

      await expect(result).resolves.toEqual({
        stations: [withoutDistance(totalStation), withoutDistance(carrefourStation)],
        unavailableStationIdentifiers: ['de-unavailable'],
        failures: [],
      });
    });

    it('keeps the loaded stations when other requests fail', async () => {
      const result = stationsApi.loadStationsByIdentifiers([
        'fr-75001001',
        'fr-75005002',
        'fr-broken',
      ]);

      httpTesting.expectOne('/api/stations/fr-75001001').flush(withoutDistance(totalStation));
      httpTesting
        .expectOne('/api/stations/fr-75005002')
        .flush(
          { statusCode: 502, message: 'Upstream unavailable' },
          { status: 502, statusText: 'Bad Gateway' }
        );
      httpTesting.expectOne('/api/stations/fr-broken').flush({ id: 'fr-broken' });

      const { stations, unavailableStationIdentifiers, failures } = await result;
      expect(stations).toEqual([withoutDistance(totalStation)]);
      expect(unavailableStationIdentifiers).toEqual([]);
      expect(failures.map(failure => failure.stationIdentifier)).toEqual([
        'fr-75005002',
        'fr-broken',
      ]);
      expect(failures[0]?.error).toBeInstanceOf(HttpErrorResponse);
      expect(failures[1]?.error).toBeInstanceOf(UnexpectedResponseError);
    });
  });
});

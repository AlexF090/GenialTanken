import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import type { HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { carrefourStation, totalStation, withoutDistance } from '../../../testing/station-fixtures';
import { StationsApi } from './stations-api';
import type { StationsSearch } from './stations-api';
import { UnexpectedResponseError } from '../http/unexpected-response-error';
import { StationSourceUnavailableError } from './station-source-unavailable-error';

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
    const BY_IDENTIFIERS_URL = '/api/stations/by-identifiers';
    const BAD_GATEWAY = { status: 502, statusText: 'Bad Gateway' };
    const BAD_GATEWAY_BODY = { statusCode: 502, message: 'Upstream unavailable' };

    const identifiersOf = (request: HttpRequest<unknown>): string | null =>
      request.url === BY_IDENTIFIERS_URL ? request.params.get('identifiers') : null;

    const stationIdentifiers = (count: number): string[] =>
      Array.from({ length: count }, (_, index) => `fr-${String(index + 1)}`);

    it('sends no request without identifiers', async () => {
      await expect(stationsApi.loadStationsByIdentifiers([])).resolves.toEqual({
        stations: [],
        unavailableStationIdentifiers: [],
        failures: [],
      });
      httpTesting.expectNone(() => true);
    });

    it('loads all stations with one request and reports unavailable identifiers', async () => {
      const result = stationsApi.loadStationsByIdentifiers([
        'fr-75001001',
        'de-unavailable',
        'fr-75005002',
      ]);

      httpTesting
        .expectOne(`${BY_IDENTIFIERS_URL}?identifiers=fr-75001001,de-unavailable,fr-75005002`)
        .flush({
          stations: [withoutDistance(totalStation), withoutDistance(carrefourStation)],
          unavailableIdentifiers: ['de-unavailable'],
          failedIdentifiers: [],
        });

      await expect(result).resolves.toEqual({
        stations: [withoutDistance(totalStation), withoutDistance(carrefourStation)],
        unavailableStationIdentifiers: ['de-unavailable'],
        failures: [],
      });
    });

    it('URL-encodes the identifiers', async () => {
      const result = stationsApi.loadStationsByIdentifiers(['fr-1&x', 'fr 2']);

      httpTesting
        .expectOne(`${BY_IDENTIFIERS_URL}?identifiers=fr-1%26x,fr%202`)
        .flush({ stations: [], unavailableIdentifiers: ['fr-1&x', 'fr 2'], failedIdentifiers: [] });

      await expect(result).resolves.toMatchObject({
        unavailableStationIdentifiers: ['fr-1&x', 'fr 2'],
      });
    });

    it('keeps the order of the requested identifiers', async () => {
      const result = stationsApi.loadStationsByIdentifiers(['fr-75005002', 'fr-75001001']);

      httpTesting
        .expectOne(request => identifiersOf(request) !== null)
        .flush({
          stations: [withoutDistance(totalStation), withoutDistance(carrefourStation)],
          unavailableIdentifiers: [],
          failedIdentifiers: [],
        });

      const { stations } = await result;
      expect(stations.map(station => station.id)).toEqual(['fr-75005002', 'fr-75001001']);
    });

    it('splits more than 50 identifiers into one request per chunk and merges the answers', async () => {
      const identifiers = stationIdentifiers(51);
      const result = stationsApi.loadStationsByIdentifiers(identifiers);

      const requests = httpTesting.match(request => identifiersOf(request) !== null);
      expect(requests.map(request => identifiersOf(request.request))).toEqual([
        identifiers.slice(0, 50).join(','),
        'fr-51',
      ]);
      requests[0]?.flush({
        stations: [],
        unavailableIdentifiers: identifiers.slice(0, 49),
        failedIdentifiers: ['fr-50'],
      });
      requests[1]?.flush({
        stations: [],
        unavailableIdentifiers: ['fr-51'],
        failedIdentifiers: [],
      });

      const { unavailableStationIdentifiers, failures } = await result;
      expect(unavailableStationIdentifiers).toEqual([...identifiers.slice(0, 49), 'fr-51']);
      expect(failures.map(failure => failure.stationIdentifier)).toEqual(['fr-50']);
      expect(failures[0]?.error).toBeInstanceOf(StationSourceUnavailableError);
    });

    it('marks every identifier of a failed chunk as failed and keeps the other chunks', async () => {
      const identifiers = stationIdentifiers(51);
      const result = stationsApi.loadStationsByIdentifiers(identifiers);

      const [firstChunk, secondChunk] = httpTesting.match(
        request => identifiersOf(request) !== null
      );
      firstChunk?.flush(BAD_GATEWAY_BODY, BAD_GATEWAY);
      secondChunk?.flush({
        stations: [withoutDistance(totalStation)],
        unavailableIdentifiers: [],
        failedIdentifiers: [],
      });

      const { stations, unavailableStationIdentifiers, failures } = await result;
      expect(stations).toEqual([withoutDistance(totalStation)]);
      expect(unavailableStationIdentifiers).toEqual([]);
      expect(failures.map(failure => failure.stationIdentifier)).toEqual(identifiers.slice(0, 50));
      expect(failures.every(failure => failure.error instanceof HttpErrorResponse)).toBe(true);
    });

    it('marks the identifiers as failed with an UnexpectedResponseError on a contract violation', async () => {
      const result = stationsApi.loadStationsByIdentifiers(['fr-75001001']);

      httpTesting.expectOne(request => identifiersOf(request) !== null).flush({ stations: [] });

      const { stations, failures } = await result;
      expect(stations).toEqual([]);
      expect(failures.map(failure => failure.stationIdentifier)).toEqual(['fr-75001001']);
      expect(failures[0]?.error).toBeInstanceOf(UnexpectedResponseError);
    });
  });
});

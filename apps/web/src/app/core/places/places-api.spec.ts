import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { bastillePlace, kasselPlace } from '../../../testing/place-fixtures';
import { UnexpectedResponseError } from '../http/unexpected-response-error';
import { PlacesApi } from './places-api';

describe('PlacesApi', () => {
  let placesApi: PlacesApi;
  let httpTesting: HttpTestingController;
  let injector: Injector;

  const settle = (): Promise<void> => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    placesApi = TestBed.inject(PlacesApi);
    httpTesting = TestBed.inject(HttpTestingController);
    injector = TestBed.inject(Injector);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('requests the places matching the trimmed query with the default limit', async () => {
    const places = runInInjectionContext(injector, () =>
      placesApi.placesMatching(() => '  Place de la  ')
    );
    TestBed.tick();

    httpTesting
      .expectOne('/api/places?query=Place%20de%20la&limit=6')
      .flush([bastillePlace, kasselPlace]);
    await settle();

    expect(places.value()).toEqual([bastillePlace, kasselPlace]);
  });

  it('sends no request for a missing or too short query', () => {
    const query = signal<string | undefined>(undefined);
    const places = runInInjectionContext(injector, () => placesApi.placesMatching(query));
    TestBed.tick();

    query.set('  Ka ');
    TestBed.tick();

    httpTesting.expectNone(() => true);
    expect(places.status()).toBe('idle');
    expect(places.value()).toBeUndefined();
  });

  it('requests again when the query changes', async () => {
    const query = signal('Bastille');
    const places = runInInjectionContext(injector, () => placesApi.placesMatching(query));
    TestBed.tick();
    httpTesting.expectOne('/api/places?query=Bastille&limit=6').flush([bastillePlace]);
    await settle();

    query.set('Kassel');
    TestBed.tick();

    httpTesting.expectOne('/api/places?query=Kassel&limit=6').flush([kasselPlace]);
    await settle();
    expect(places.value()).toEqual([kasselPlace]);
  });

  it('fails with an UnexpectedResponseError when the body violates the contract', async () => {
    const places = runInInjectionContext(injector, () => placesApi.placesMatching(() => 'Kassel'));
    TestBed.tick();

    httpTesting.expectOne(() => true).flush([{ id: 'N1' }]);
    await settle();

    expect(places.status()).toBe('error');
    expect(places.error()).toBeInstanceOf(UnexpectedResponseError);
  });
});

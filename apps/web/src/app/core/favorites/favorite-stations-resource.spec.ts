import { signal } from '@angular/core';
import type { StationLookup } from '@genialtanken/contracts';
import { TestBed } from '@angular/core/testing';
import { stationLookupUrl } from '../../../testing/api-urls';
import { FakeStorage } from '../../../testing/fake-storage';
import { configurePageTest } from '../../../testing/render-page';
import type { PageTestContext } from '../../../testing/render-page';
import {
  carrefourStation,
  essoStation,
  totalStation,
  withoutDistance,
  withPrices,
} from '../../../testing/station-fixtures';
import { FavoritesStore } from './favorites-store';
import { FavoriteStationsResource } from './favorite-stations-resource';
import { CURRENT_DATE } from '../time/current-date';

const FIRST_ANSWER_TIME = new Date('2026-10-23T12:00:00');
const SECOND_ANSWER_TIME = new Date('2026-10-23T12:07:00');

const answer = (...stations: (typeof totalStation)[]) => ({
  stations: stations.map(withoutDistance),
  unavailableIdentifiers: [],
  failedIdentifiers: [],
});

const identifiersOf = (resource: FavoriteStationsResource): string[] =>
  resource.stations().map(station => station.id);

describe('FavoriteStationsResource', () => {
  let context: PageTestContext;
  const clock = signal(FIRST_ANSWER_TIME);

  const setUp = async (favoriteIdentifiers?: string) => {
    clock.set(FIRST_ANSWER_TIME);
    context = configurePageTest({
      storage: new FakeStorage(
        favoriteIdentifiers === undefined ? {} : { favoriteIDs: favoriteIdentifiers }
      ),
      providers: [{ provide: CURRENT_DATE, useValue: clock.asReadonly() }],
    });
    const resource = TestBed.inject(FavoriteStationsResource);
    await context.settle();
    return { resource, favorites: TestBed.inject(FavoritesStore) };
  };

  afterEach(() => {
    context.httpTesting.verify();
  });

  it('sends no request without favorites', async () => {
    const { resource } = await setUp();

    expect(resource.stations()).toEqual([]);
    expect(resource.isLoading()).toBe(false);
  });

  it('loads the stored favorites with one request', async () => {
    const { resource } = await setUp('["fr-75001001","fr-75005002"]');

    context.httpTesting
      .expectOne(stationLookupUrl('fr-75001001,fr-75005002'))
      .flush(answer(totalStation, carrefourStation));
    await context.settle();

    expect(identifiersOf(resource)).toEqual([totalStation.id, carrefourStation.id]);
  });

  it('hides an unstarred station at once without a request', async () => {
    const { resource, favorites } = await setUp('["fr-75001001","fr-75005002"]');
    context.httpTesting
      .expectOne(stationLookupUrl('fr-75001001,fr-75005002'))
      .flush(answer(totalStation, carrefourStation));
    await context.settle();

    favorites.toggle(totalStation.id);
    await context.settle();

    expect(identifiersOf(resource)).toEqual([carrefourStation.id]);
    context.httpTesting.expectNone(() => true);

    favorites.toggle(totalStation.id);
    await context.settle();

    expect(identifiersOf(resource)).toEqual([carrefourStation.id, totalStation.id]);
  });

  it('loads again for a newly starred station and keeps the shown ones meanwhile', async () => {
    const { resource, favorites } = await setUp('["fr-75001001"]');
    context.httpTesting.expectOne(stationLookupUrl('fr-75001001')).flush(answer(totalStation));
    await context.settle();

    expect(identifiersOf(resource)).toEqual([totalStation.id]);

    favorites.toggle(essoStation.id);
    await context.settle();

    expect(identifiersOf(resource)).toEqual([totalStation.id]);
    expect(resource.isLoading()).toBe(true);
    context.httpTesting
      .expectOne(stationLookupUrl(`fr-75001001,${essoStation.id}`))
      .flush(answer(totalStation, essoStation));
    await context.settle();

    expect(identifiersOf(resource)).toEqual([totalStation.id, essoStation.id]);
  });

  it('refreshes loaded favorites on request, but never a first load on its way', async () => {
    const { resource } = await setUp('["fr-75001001"]');

    resource.refreshIfLoaded();
    await context.settle();
    context.httpTesting.expectOne(stationLookupUrl('fr-75001001')).flush(answer(totalStation));
    await context.settle();

    resource.refreshIfLoaded();
    await context.settle();

    expect(identifiersOf(resource)).toEqual([totalStation.id]);
    context.httpTesting.expectOne(stationLookupUrl('fr-75001001')).flush(answer(totalStation));
  });

  it('keeps the shown prices when a refresh fails and reports the failure alongside', async () => {
    const { resource } = await setUp('["fr-75001001","fr-75005002"]');
    context.httpTesting
      .expectOne(stationLookupUrl('fr-75001001,fr-75005002'))
      .flush(answer(totalStation, carrefourStation));
    await context.settle();

    resource.refreshIfLoaded();
    await context.settle();
    context.httpTesting
      .expectOne(stationLookupUrl('fr-75001001,fr-75005002'))
      .flush(null, { status: 502, statusText: 'Bad Gateway' });
    await context.settle();

    expect(identifiersOf(resource)).toEqual([totalStation.id, carrefourStation.id]);
    expect(resource.loaded()?.failures.map(failure => failure.stationIdentifier)).toEqual([
      totalStation.id,
      carrefourStation.id,
    ]);
  });

  it('shows newly loaded prices next to the kept ones of failed stations', async () => {
    const { resource } = await setUp('["fr-75001001","fr-75005002"]');
    context.httpTesting
      .expectOne(stationLookupUrl('fr-75001001,fr-75005002'))
      .flush(answer(totalStation, carrefourStation));
    await context.settle();

    resource.refreshIfLoaded();
    await context.settle();
    const updatedCarrefour = withPrices(carrefourStation, { e5: 1.799 });
    context.httpTesting.expectOne(stationLookupUrl('fr-75001001,fr-75005002')).flush({
      stations: [withoutDistance(updatedCarrefour)],
      unavailableIdentifiers: [],
      failedIdentifiers: [totalStation.id],
    });
    await context.settle();

    expect(identifiersOf(resource)).toEqual([totalStation.id, carrefourStation.id]);
    expect(resource.stations()[1]).toEqual(withoutDistance(updatedCarrefour));
  });

  it('asks only for the still starred stations when it refreshes', async () => {
    const { resource, favorites } = await setUp('["fr-75001001","fr-75005002"]');
    context.httpTesting
      .expectOne(stationLookupUrl('fr-75001001,fr-75005002'))
      .flush(answer(totalStation, carrefourStation));
    await context.settle();

    favorites.toggle(totalStation.id);
    await context.settle();
    resource.refreshIfLoaded();
    await context.settle();

    context.httpTesting
      .expectOne(stationLookupUrl(carrefourStation.id))
      .flush(answer(carrefourStation));
    await context.settle();

    expect(identifiersOf(resource)).toEqual([carrefourStation.id]);
  });

  describe('load time', () => {
    const loadThenRefresh = async (refreshAnswer: StationLookup) => {
      const { resource } = await setUp('["fr-75001001","fr-75005002"]');
      context.httpTesting
        .expectOne(stationLookupUrl('fr-75001001,fr-75005002'))
        .flush(answer(totalStation, carrefourStation));
      await context.settle();
      expect(resource.loadedAt()).toEqual(FIRST_ANSWER_TIME);

      clock.set(SECOND_ANSWER_TIME);
      resource.refreshIfLoaded();
      await context.settle();
      context.httpTesting
        .expectOne(stationLookupUrl('fr-75001001,fr-75005002'))
        .flush(refreshAnswer);
      await context.settle();
      return resource;
    };

    it('is undefined without favorites', async () => {
      const { resource } = await setUp();

      expect(resource.loadedAt()).toBeUndefined();
    });

    it('moves on with every answer that loads all favorites', async () => {
      const resource = await loadThenRefresh(answer(totalStation, carrefourStation));

      expect(resource.loadedAt()).toEqual(SECOND_ANSWER_TIME);
    });

    it('stays at the older answer while stations of failed lookups keep its prices', async () => {
      const resource = await loadThenRefresh({
        stations: [withoutDistance(carrefourStation)],
        unavailableIdentifiers: [],
        failedIdentifiers: [totalStation.id],
      });

      expect(resource.loadedAt()).toEqual(FIRST_ANSWER_TIME);
    });
  });
});

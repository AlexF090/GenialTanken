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
} from '../../../testing/station-fixtures';
import { FavoritesStore } from './favorites-store';
import { FavoriteStationsResource } from './favorite-stations-resource';

const answer = (...stations: (typeof totalStation)[]) => ({
  stations: stations.map(withoutDistance),
  unavailableIdentifiers: [],
  failedIdentifiers: [],
});

const identifiersOf = (resource: FavoriteStationsResource): string[] =>
  resource.stations().map(station => station.id);

describe('FavoriteStationsResource', () => {
  let context: PageTestContext;

  const setUp = async (favoriteIdentifiers?: string) => {
    context = configurePageTest({
      storage: new FakeStorage(
        favoriteIdentifiers === undefined ? {} : { favoriteIDs: favoriteIdentifiers }
      ),
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
});

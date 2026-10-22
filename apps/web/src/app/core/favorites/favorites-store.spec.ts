import { TestBed } from '@angular/core/testing';
import { FakeStorage, storedFavorites } from '../../../testing/fake-storage';
import { BROWSER_STORAGE } from '../browser-storage';
import { FavoritesStore } from './favorites-store';
import { provideLocalStorageFavorites } from './local-storage-favorites-repository';

const createStore = (storage: Storage): FavoritesStore => {
  TestBed.configureTestingModule({
    providers: [{ provide: BROWSER_STORAGE, useValue: storage }, provideLocalStorageFavorites()],
  });
  return TestBed.inject(FavoritesStore);
};

describe('FavoritesStore', () => {
  it('has no favorites when nothing is stored', () => {
    const store = createStore(new FakeStorage());

    expect(store.favoriteStationIdentifiers()).toEqual([]);
    expect(store.isFavorite('station-1')).toBe(false);
  });

  it('restores favorites stored by the legacy app', () => {
    const store = createStore(new FakeStorage({ favoriteIDs: '["station-1","station-2"]' }));

    expect(store.favoriteStationIdentifiers()).toEqual(['station-1', 'station-2']);
    expect(store.isFavorite('station-2')).toBe(true);
  });

  it('stars and unstars a station and persists every change', () => {
    const storage = new FakeStorage();
    const store = createStore(storage);

    store.toggle('station-1');
    store.toggle('station-2');
    expect(store.favoriteStationIdentifiers()).toEqual(['station-1', 'station-2']);
    expect(storedFavorites(storage)).toBe('["station-1","station-2"]');

    store.toggle('station-1');
    expect(store.favoriteStationIdentifiers()).toEqual(['station-2']);
    expect(storedFavorites(storage)).toBe('["station-2"]');
  });

  it('removes several stale favorites at once', () => {
    const storage = new FakeStorage({ favoriteIDs: '["station-1","station-2","station-3"]' });
    const store = createStore(storage);

    store.remove(['station-1', 'station-3']);

    expect(store.favoriteStationIdentifiers()).toEqual(['station-2']);
    expect(storedFavorites(storage)).toBe('["station-2"]');
  });

  it('ignores stored favorites that are not a list of ids', () => {
    const store = createStore(new FakeStorage({ favoriteIDs: '{"id":1}' }));

    expect(store.favoriteStationIdentifiers()).toEqual([]);
  });
});

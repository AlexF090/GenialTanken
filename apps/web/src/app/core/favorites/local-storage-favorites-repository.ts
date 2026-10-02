import { inject, Injectable } from '@angular/core';
import type { Provider } from '@angular/core';
import { BROWSER_STORAGE } from '../browser-storage';
import { FavoritesRepository } from './favorites-repository';

/** Same key as the legacy React app, so existing favorites survive the rewrite. */
const FAVORITES_STORAGE_KEY = 'favoriteIDs';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

@Injectable()
export class LocalStorageFavoritesRepository extends FavoritesRepository {
  private readonly storage = inject(BROWSER_STORAGE);

  load(): readonly string[] {
    const serializedIds = this.storage.getItem(FAVORITES_STORAGE_KEY);
    if (serializedIds === null) {
      return [];
    }
    try {
      const storedValue: unknown = JSON.parse(serializedIds);
      return isStringArray(storedValue) ? storedValue : [];
    } catch (error) {
      console.warn('Ignoring stored favorites that are not valid JSON', error);
      return [];
    }
  }

  save(stationIds: readonly string[]): void {
    try {
      this.storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(stationIds));
    } catch (error) {
      console.warn('Favorites could not be persisted; they apply to this session only', error);
    }
  }
}

export const provideLocalStorageFavorites = (): Provider => ({
  provide: FavoritesRepository,
  useClass: LocalStorageFavoritesRepository,
});

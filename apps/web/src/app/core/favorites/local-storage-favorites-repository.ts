import { inject, Injectable } from '@angular/core';
import type { Provider } from '@angular/core';
import { LOCAL_STORAGE } from '../browser-storage';
import { Logger } from '../logging/logger';
import { FavoritesRepository } from './favorites-repository';

/**
 * Key kept from the legacy React app. Its entries are not migrated: legacy identifiers lack the
 * country prefix (`fr-…`), so they fail the lookup, and the app moved to another origin anyway.
 */
export const FAVORITES_STORAGE_KEY = 'favoriteIDs';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

@Injectable()
export class LocalStorageFavoritesRepository extends FavoritesRepository {
  private readonly storage = inject(LOCAL_STORAGE);
  private readonly logger = inject(Logger);

  load(): readonly string[] {
    const serializedIdentifiers = this.storage.getItem(FAVORITES_STORAGE_KEY);
    if (serializedIdentifiers === null) {
      return [];
    }
    try {
      const storedValue: unknown = JSON.parse(serializedIdentifiers);
      return isStringArray(storedValue) ? storedValue : [];
    } catch (error) {
      this.logger.warn('Ignoring stored favorites that are not valid JSON', error);
      return [];
    }
  }

  save(stationIdentifiers: readonly string[]): void {
    try {
      this.storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(stationIdentifiers));
    } catch (error) {
      this.logger.warn('Favorites could not be persisted; they apply to this session only', error);
    }
  }
}

export const provideLocalStorageFavorites = (): Provider => ({
  provide: FavoritesRepository,
  useClass: LocalStorageFavoritesRepository,
});

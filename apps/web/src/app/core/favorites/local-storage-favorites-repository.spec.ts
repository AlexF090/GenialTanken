import { TestBed } from '@angular/core/testing';
import type { MockInstance } from 'vitest';
import { FakeStorage } from '../../../testing/fake-storage';
import { BROWSER_STORAGE } from '../browser-storage';
import { Logger } from '../logging/logger';
import { LocalStorageFavoritesRepository } from './local-storage-favorites-repository';

const FAVORITES_STORAGE_KEY = 'favoriteIDs';

describe('LocalStorageFavoritesRepository', () => {
  let storage: FakeStorage;
  let warn: MockInstance<Logger['warn']>;

  const createRepository = (): LocalStorageFavoritesRepository => {
    TestBed.configureTestingModule({
      providers: [LocalStorageFavoritesRepository, { provide: BROWSER_STORAGE, useValue: storage }],
    });
    warn = vi.spyOn(TestBed.inject(Logger), 'warn').mockImplementation(() => undefined);
    return TestBed.inject(LocalStorageFavoritesRepository);
  };

  beforeEach(() => {
    storage = new FakeStorage();
  });

  describe('load', () => {
    it('returns no favorites when nothing is stored', () => {
      expect(createRepository().load()).toEqual([]);
    });

    it('returns the stored identifiers', () => {
      storage.setItem(FAVORITES_STORAGE_KEY, '["fr-75001001","de-1"]');

      expect(createRepository().load()).toEqual(['fr-75001001', 'de-1']);
      expect(warn).not.toHaveBeenCalled();
    });

    it('ignores stored favorites that are not valid JSON and warns', () => {
      storage.setItem(FAVORITES_STORAGE_KEY, '[not json');

      expect(createRepository().load()).toEqual([]);
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        'Ignoring stored favorites that are not valid JSON',
        expect.any(SyntaxError)
      );
    });

    it('ignores a stored array that contains other values than strings', () => {
      storage.setItem(FAVORITES_STORAGE_KEY, '["fr-75001001",42]');

      expect(createRepository().load()).toEqual([]);
    });
  });

  describe('save', () => {
    it('stores the identifiers as JSON', () => {
      createRepository().save(['fr-75001001', 'de-1']);

      expect(storage.getItem(FAVORITES_STORAGE_KEY)).toBe('["fr-75001001","de-1"]');
    });

    it('keeps going and warns when the storage refuses to write', () => {
      const quotaExceeded = new DOMException('Storage is full', 'QuotaExceededError');
      vi.spyOn(storage, 'setItem').mockImplementation(() => {
        throw quotaExceeded;
      });
      const repository = createRepository();

      expect(() => {
        repository.save(['fr-75001001']);
      }).not.toThrow();
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        'Favorites could not be persisted; they apply to this session only',
        quotaExceeded
      );
    });
  });
});

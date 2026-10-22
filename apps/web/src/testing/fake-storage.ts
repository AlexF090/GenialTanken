import { FAVORITES_STORAGE_KEY } from '../app/core/favorites/local-storage-favorites-repository';
import { SETTINGS_STORAGE_KEY } from '../app/core/settings/settings-store';

/** In-memory `Storage` for tests. */
export class FakeStorage implements Storage {
  private readonly entries = new Map<string, string>();

  constructor(initialEntries: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initialEntries)) {
      this.entries.set(key, value);
    }
  }

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }
}

/** The settings as the app persisted them, as stored JSON text. */
export const storedSettings = (storage: Storage): string | null =>
  storage.getItem(SETTINGS_STORAGE_KEY);

/** The favorite station identifiers as the app persisted them, as stored JSON text. */
export const storedFavorites = (storage: Storage): string | null =>
  storage.getItem(FAVORITES_STORAGE_KEY);

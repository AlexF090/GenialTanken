import { computed, inject, Injectable, signal } from '@angular/core';
import { FavoritesRepository } from './favorites-repository';

/** Ids of the stations the user starred, in the order they were added. */
@Injectable({ providedIn: 'root' })
export class FavoritesStore {
  private readonly repository = inject(FavoritesRepository);
  private readonly stationIds = signal<readonly string[]>(this.repository.load());

  readonly favoriteStationIds = this.stationIds.asReadonly();
  readonly favoriteStationIdSet = computed<ReadonlySet<string>>(() => new Set(this.stationIds()));

  isFavorite(stationId: string): boolean {
    return this.favoriteStationIdSet().has(stationId);
  }

  toggle(stationId: string): void {
    const currentIds = this.stationIds();
    this.persist(
      currentIds.includes(stationId)
        ? currentIds.filter(id => id !== stationId)
        : [...currentIds, stationId]
    );
  }

  remove(stationIdsToRemove: readonly string[]): void {
    if (stationIdsToRemove.length === 0) {
      return;
    }
    this.persist(this.stationIds().filter(id => !stationIdsToRemove.includes(id)));
  }

  private persist(stationIds: readonly string[]): void {
    this.stationIds.set(stationIds);
    this.repository.save(stationIds);
  }
}

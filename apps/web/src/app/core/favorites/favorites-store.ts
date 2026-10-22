import { computed, inject, Injectable, signal } from '@angular/core';
import { FavoritesRepository } from './favorites-repository';

/** Identifiers of the stations the user starred, in the order they were added. */
@Injectable({ providedIn: 'root' })
export class FavoritesStore {
  private readonly repository = inject(FavoritesRepository);
  private readonly stationIdentifiers = signal<readonly string[]>(this.repository.load());

  readonly favoriteStationIdentifiers = this.stationIdentifiers.asReadonly();
  readonly favoriteStationIdentifierSet = computed<ReadonlySet<string>>(
    () => new Set(this.stationIdentifiers())
  );

  isFavorite(stationIdentifier: string): boolean {
    return this.favoriteStationIdentifierSet().has(stationIdentifier);
  }

  toggle(stationIdentifier: string): void {
    const currentIdentifiers = this.stationIdentifiers();
    this.persist(
      currentIdentifiers.includes(stationIdentifier)
        ? currentIdentifiers.filter(identifier => identifier !== stationIdentifier)
        : [...currentIdentifiers, stationIdentifier]
    );
  }

  remove(stationIdentifiersToRemove: readonly string[]): void {
    if (stationIdentifiersToRemove.length === 0) {
      return;
    }
    this.persist(
      this.stationIdentifiers().filter(
        identifier => !stationIdentifiersToRemove.includes(identifier)
      )
    );
  }

  private persist(stationIdentifiers: readonly string[]): void {
    this.stationIdentifiers.set(stationIdentifiers);
    this.repository.save(stationIdentifiers);
  }
}

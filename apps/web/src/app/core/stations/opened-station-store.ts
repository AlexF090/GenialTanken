import { computed, Injectable, signal } from '@angular/core';
import type { Station } from '@genialtanken/contracts';

interface OpenedStation {
  readonly station: Station;
  readonly loadedAt: Date | undefined;
}

/**
 * The station whose card is open, as loaded by the card. The explore page reads it to show the
 * station on the map even when it is not among the search results (e.g. opened from favorites).
 */
@Injectable({ providedIn: 'root' })
export class OpenedStationStore {
  private readonly state = signal<OpenedStation | undefined>(undefined);

  readonly station = computed(() => this.state()?.station);
  /** When the station's prices arrived from the API, not when the card opened. */
  readonly loadedAt = computed(() => this.state()?.loadedAt);

  open(station: Station, loadedAt: Date | undefined): void {
    this.state.set({ station, loadedAt });
  }

  close(): void {
    this.state.set(undefined);
  }
}

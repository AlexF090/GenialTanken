import { Injectable, signal } from '@angular/core';
import type { Station } from '@genialtanken/contracts';

/**
 * The station whose card is open, as loaded by the card. The explore page reads it to show the
 * station on the map even when it is not among the search results (e.g. opened from favorites).
 */
@Injectable({ providedIn: 'root' })
export class OpenedStationStore {
  private readonly state = signal<Station | undefined>(undefined);

  readonly station = this.state.asReadonly();

  open(station: Station): void {
    this.state.set(station);
  }

  close(): void {
    this.state.set(undefined);
  }
}

import {
  afterNextRender,
  assertInInjectionContext,
  effect,
  inject,
  Injector,
  untracked,
} from '@angular/core';
import type { Signal, WritableSignal } from '@angular/core';
import { Viewport } from '../../core/layout/viewport';
import type { BottomSheet } from '../../ui/bottom-sheet/bottom-sheet';
import type { SnapPosition } from '../../ui/bottom-sheet/bottom-sheet-snap';
import type { StationList } from '../../ui/station-list/station-list';

export type ScrollableSheet = Pick<BottomSheet, 'scrollPosition' | 'restoreScrollPosition'>;
export type StationFocusTarget = Pick<StationList, 'focusStation'>;

/** A station's card (`stations/:id`). */
export interface StationCard {
  kind: 'station';
  stationIdentifier: string;
}

/** The list of all favorites (`favorites`). */
export interface FavoritesCard {
  kind: 'favorites';
}

/** What the sheet shows instead of the list. */
export type SheetCard = StationCard | FavoritesCard;

export const isSameCard = (first: SheetCard | undefined, second: SheetCard | undefined): boolean =>
  first?.kind === second?.kind &&
  (first?.kind !== 'station' ||
    (second?.kind === 'station' && first.stationIdentifier === second.stationIdentifier));

export interface SheetFollowsCardOptions {
  openedCard: Signal<SheetCard | undefined>;
  bottomSheet: Signal<ScrollableSheet | undefined>;
  stationList: Signal<StationFocusTarget | undefined>;
  snapPosition: WritableSignal<SnapPosition>;
  /** Selects the station of the closed card in the list. */
  selectInList: (stationIdentifier: string) => void;
  /**
   * Called when the closed card has no row to focus (the favorites, a station not in the results
   * for the chosen fuel, or a list still loading), so the focus does not fall back to the body.
   */
  focusInsteadOfRow: (closedCard: SheetCard) => void;
}

/**
 * Opening a card shows it from its top, a station card at half and the favorites at least at
 * half; closing it returns to the list where it was, with the station of a station card still
 * selected and focused. Call it in an injection context.
 */
export const injectSheetFollowsCard = (options: SheetFollowsCardOptions): void => {
  assertInInjectionContext(injectSheetFollowsCard);
  const isCompactViewport = inject(Viewport).isCompactViewport;
  const injector = inject(Injector);
  let previousCard: SheetCard | undefined;
  let listScrollPosition = 0;
  effect(() => {
    const card = options.openedCard();
    const closedCard = previousCard;
    previousCard = card;
    if (isSameCard(card, closedCard)) {
      return;
    }
    untracked(() => {
      const bottomSheet = options.bottomSheet();
      if (card !== undefined) {
        if (closedCard === undefined) {
          listScrollPosition = bottomSheet?.scrollPosition() ?? 0;
        }
        bottomSheet?.restoreScrollPosition(0);
        // A station card opens at half like a place card in Apple Maps, so the map keeps showing
        // the station; the favorites only lift a peeking sheet.
        if (isCompactViewport() && (card.kind === 'station' || options.snapPosition() === 'peek')) {
          options.snapPosition.set('half');
        }
        return;
      }
      if (closedCard === undefined) {
        return;
      }
      if (closedCard.kind === 'station') {
        options.selectInList(closedCard.stationIdentifier);
      }
      afterNextRender(
        () => {
          bottomSheet?.restoreScrollPosition(listScrollPosition);
          const isRowFocused =
            closedCard.kind === 'station' &&
            options.stationList()?.focusStation(closedCard.stationIdentifier) === true;
          if (!isRowFocused) {
            options.focusInsteadOfRow(closedCard);
          }
        },
        { injector }
      );
    });
  });
};

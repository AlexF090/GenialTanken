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

export interface SheetFollowsCardOptions {
  openedStationIdentifier: Signal<string | undefined>;
  bottomSheet: Signal<BottomSheet | undefined>;
  stationList: Signal<StationList | undefined>;
  snapPosition: WritableSignal<SnapPosition>;
  /** Selects the station of the closed card in the list. */
  selectInList: (stationIdentifier: string) => void;
}

/**
 * Opening a card shows it from its top and lifts a peeking sheet; closing it returns to the list
 * where it was, with the station still selected and focused. Call it in an injection context.
 */
export const injectSheetFollowsCard = (options: SheetFollowsCardOptions): void => {
  assertInInjectionContext(injectSheetFollowsCard);
  const isCompactViewport = inject(Viewport).isCompactViewport;
  const injector = inject(Injector);
  let previousStationIdentifier: string | undefined;
  let listScrollPosition = 0;
  effect(() => {
    const stationIdentifier = options.openedStationIdentifier();
    const closedStationIdentifier = previousStationIdentifier;
    previousStationIdentifier = stationIdentifier;
    if (stationIdentifier === closedStationIdentifier) {
      return;
    }
    untracked(() => {
      const bottomSheet = options.bottomSheet();
      if (stationIdentifier !== undefined) {
        if (closedStationIdentifier === undefined) {
          listScrollPosition = bottomSheet?.scrollPosition() ?? 0;
        }
        bottomSheet?.restoreScrollPosition(0);
        if (isCompactViewport() && options.snapPosition() === 'peek') {
          options.snapPosition.set('half');
        }
        return;
      }
      if (closedStationIdentifier === undefined) {
        return;
      }
      options.selectInList(closedStationIdentifier);
      afterNextRender(
        () => {
          bottomSheet?.restoreScrollPosition(listScrollPosition);
          options.stationList()?.focusStation(closedStationIdentifier);
        },
        { injector }
      );
    });
  });
};

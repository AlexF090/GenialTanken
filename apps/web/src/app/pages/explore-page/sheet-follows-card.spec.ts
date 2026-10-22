import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { COMPACT_MEDIA_QUERY } from '../../core/layout/breakpoints';
import { MATCH_MEDIA } from '../../core/layout/media-query';
import type { SnapPosition } from '../../ui/bottom-sheet/bottom-sheet-snap';
import { FakeMatchMedia } from '../../../testing/fake-match-media';
import { injectSheetFollowsCard } from './sheet-follows-card';
import type { ScrollableSheet, StationFocusTarget } from './sheet-follows-card';

class FakeSheet implements ScrollableSheet {
  position = 0;

  scrollPosition(): number {
    return this.position;
  }

  restoreScrollPosition(position: number): void {
    this.position = position;
  }
}

class FakeStationList implements StationFocusTarget {
  readonly focusedStationIdentifiers: string[] = [];

  constructor(private readonly listedStationIdentifiers: readonly string[]) {}

  focusStation(stationIdentifier: string): boolean {
    if (!this.listedStationIdentifiers.includes(stationIdentifier)) {
      return false;
    }
    this.focusedStationIdentifiers.push(stationIdentifier);
    return true;
  }
}

const setUp = (
  options: { isCompactViewport?: boolean; listedStationIdentifiers?: readonly string[] } = {}
) => {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: MATCH_MEDIA,
        useValue: new FakeMatchMedia(
          options.isCompactViewport === true ? [COMPACT_MEDIA_QUERY] : []
        ).matchMedia,
      },
    ],
  });
  const openedStationIdentifier = signal<string | undefined>(undefined);
  const sheet = new FakeSheet();
  const stationList = new FakeStationList(options.listedStationIdentifiers ?? ['fr-1', 'fr-2']);
  const snapPosition = signal<SnapPosition>('peek');
  const selectedInList: string[] = [];
  let fallbackFocusCount = 0;
  TestBed.runInInjectionContext(() => {
    injectSheetFollowsCard({
      openedStationIdentifier,
      bottomSheet: signal(sheet),
      stationList: signal(stationList),
      snapPosition,
      selectInList: stationIdentifier => {
        selectedInList.push(stationIdentifier);
      },
      focusInsteadOfStation: () => {
        fallbackFocusCount += 1;
      },
    });
  });
  TestBed.tick();
  const show = (stationIdentifier: string | undefined): void => {
    openedStationIdentifier.set(stationIdentifier);
    TestBed.tick();
  };
  return {
    show,
    sheet,
    stationList,
    snapPosition,
    selectedInList,
    fallbackFocusCount: () => fallbackFocusCount,
  };
};

describe('injectSheetFollowsCard', () => {
  it('shows an opened card from its top', () => {
    const { show, sheet } = setUp();
    sheet.position = 240;

    show('fr-1');

    expect(sheet.position).toBe(0);
  });

  it('lifts a peeking sheet to half on a phone', () => {
    const { show, snapPosition } = setUp({ isCompactViewport: true });

    show('fr-1');

    expect(snapPosition()).toBe('half');
  });

  it('leaves the side panel alone on a wide screen', () => {
    const { show, snapPosition } = setUp({ isCompactViewport: false });

    show('fr-1');

    expect(snapPosition()).toBe('peek');
  });

  it('returns to the list where it was, with the closed station selected and focused', () => {
    const { show, sheet, stationList, selectedInList, fallbackFocusCount } = setUp();
    sheet.position = 240;
    show('fr-1');

    show(undefined);

    expect(sheet.position).toBe(240);
    expect(selectedInList).toEqual(['fr-1']);
    expect(stationList.focusedStationIdentifiers).toEqual(['fr-1']);
    expect(fallbackFocusCount()).toBe(0);
  });

  it('keeps the list position of the first card when cards follow each other', () => {
    const { show, sheet, selectedInList } = setUp();
    sheet.position = 240;
    show('fr-1');
    show('fr-2');

    show(undefined);

    expect(sheet.position).toBe(240);
    expect(selectedInList).toEqual(['fr-2']);
  });

  it('moves the focus elsewhere when the closed station is not in the list', () => {
    const { show, stationList, fallbackFocusCount } = setUp({ listedStationIdentifiers: [] });
    show('fr-1');

    show(undefined);

    expect(stationList.focusedStationIdentifiers).toEqual([]);
    expect(fallbackFocusCount()).toBe(1);
  });
});

import { TestBed } from '@angular/core/testing';
import { COMPACT_MEDIA_QUERY } from '../../core/layout/breakpoints';
import { MATCH_MEDIA } from '../../core/layout/media-query';
import { BottomSheet } from '../../ui/bottom-sheet/bottom-sheet';
import { StationsMap } from '../../ui/stations-map/stations-map';
import { FakeMatchMedia } from '../../../testing/fake-match-media';
import { configurePageTest, getButton, renderComponent } from '../../../testing/render-page';
import type { PageTestContext } from '../../../testing/render-page';
import {
  carrefourStation,
  totalStation,
  unbrandedStation,
} from '../../../testing/station-fixtures';
import { ExplorePage } from './explore-page';
import { childComponent, EIFFEL_TOWER_E5_URL, placeSearchInput } from './explore-page-test-helpers';

describe('ExplorePage on a phone', () => {
  let context: PageTestContext;

  afterEach(() => {
    context.httpTesting.verify();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    TestBed.overrideProvider(MATCH_MEDIA, {
      useValue: new FakeMatchMedia([COMPACT_MEDIA_QUERY]).matchMedia,
    });
    context = configurePageTest();
  });

  const renderWithStations = async () => {
    const rendered = await renderComponent(ExplorePage);
    await context.settle();
    context.httpTesting
      .expectOne(EIFFEL_TOWER_E5_URL)
      .flush([totalStation, carrefourStation, unbrandedStation]);
    await context.settle();
    return rendered;
  };

  it.each(['peek', 'full'] as const)(
    'moves the sheet from %s to half when a price tag is chosen',
    async startPosition => {
      const { fixture } = await renderWithStations();
      const sheet = childComponent(fixture, BottomSheet);
      sheet.snapPosition.set(startPosition);
      await context.settle();

      childComponent(fixture, StationsMap).stationSelected.emit(totalStation.id);
      await context.settle();

      expect(sheet.snapPosition()).toBe('half');
    }
  );

  it('lowers a fully opened sheet to half so pin and row of a chosen station are visible', async () => {
    const { element, fixture } = await renderWithStations();
    const sheet = childComponent(fixture, BottomSheet);
    sheet.snapPosition.set('full');
    await context.settle();

    getButton(element, 'Carrefour Market').click();
    await context.settle();

    expect(sheet.snapPosition()).toBe('half');
    expect(childComponent(fixture, StationsMap).selectedStationIdentifier()).toBe(
      carrefourStation.id
    );
  });

  it('keeps a peeking sheet down when a station is chosen in the list', async () => {
    const { element, fixture } = await renderWithStations();
    const sheet = childComponent(fixture, BottomSheet);
    sheet.snapPosition.set('peek');
    await context.settle();

    getButton(element, 'Carrefour Market').click();
    await context.settle();

    expect(sheet.snapPosition()).toBe('peek');
    expect(childComponent(fixture, StationsMap).selectedStationIdentifier()).toBe(
      carrefourStation.id
    );
  });

  it('moves the sheet aside while a place is typed', async () => {
    const { fixture, element } = await renderWithStations();
    const input = placeSearchInput(element);

    input.value = 'Bas';
    input.dispatchEvent(new Event('input'));
    await context.settle();

    expect(childComponent(fixture, BottomSheet).snapPosition()).toBe('peek');
  });
});

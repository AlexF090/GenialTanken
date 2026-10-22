import { TestBed } from '@angular/core/testing';
import { COMPACT_MEDIA_QUERY } from '../../core/layout/breakpoints';
import {
  ADDS_TO_HOME_SCREEN_THROUGH_SHARE,
  INSTALLATION_HINT_STORAGE_KEY,
  TOUCH_DEVICE_MEDIA_QUERY,
} from '../../core/installation/installation-hint';
import { MATCH_MEDIA } from '../../core/layout/media-query';
import { BottomSheet } from '../../ui/bottom-sheet/bottom-sheet';
import { StationsMap } from '../../ui/stations-map/stations-map';
import { FakeMatchMedia } from '../../../testing/fake-match-media';
import {
  configurePageTest,
  getButton,
  renderComponent,
  textOf,
} from '../../../testing/render-page';
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

  it('keeps the status bar legible with a decorative scrim over the map', async () => {
    const { element } = await renderWithStations();

    const scrim = element.querySelector('app-status-bar-scrim');
    expect(scrim?.getAttribute('aria-hidden')).toBe('true');
    expect(scrim?.parentElement?.tagName).toBe('MAIN');
  });

  it('does not suggest the home screen without a browser that supports it', async () => {
    const { element } = await renderWithStations();

    expect(element.querySelector('app-installation-hint-card')).toBeNull();
  });
});

describe('ExplorePage in the browser of an iPhone', () => {
  let context: PageTestContext;

  afterEach(() => {
    context.httpTesting.verify();
  });

  beforeEach(() => {
    TestBed.overrideProvider(MATCH_MEDIA, {
      useValue: new FakeMatchMedia([COMPACT_MEDIA_QUERY, TOUCH_DEVICE_MEDIA_QUERY]).matchMedia,
    });
    TestBed.overrideProvider(ADDS_TO_HOME_SCREEN_THROUGH_SHARE, { useValue: true });
    context = configurePageTest();
  });

  const render = async () => {
    const rendered = await renderComponent(ExplorePage);
    await context.settle();
    context.httpTesting.expectOne(EIFFEL_TOWER_E5_URL).flush([totalStation]);
    await context.settle();
    return rendered;
  };

  it('suggests adding the app to the home screen at the top of the list', async () => {
    const { element } = await render();

    const hint = element.querySelector('app-installation-hint-card');
    expect(textOf(hint?.querySelector('h2'))).toBe('GenialTanken als App');
    expect(hint?.nextElementSibling?.tagName).toBe('APP-FAVORITES-ROW');
  });

  it('closes the suggestion for good', async () => {
    const { element } = await render();

    getButton(element, 'Hinweis schließen').click();
    await context.settle();

    expect(element.querySelector('app-installation-hint-card')).toBeNull();
    expect(context.storage.getItem(INSTALLATION_HINT_STORAGE_KEY)).toBe('dismissed');
  });
});

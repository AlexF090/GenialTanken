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
import { bastillePlace } from '../../../testing/place-fixtures';
import { placesUrl, stationsUrl } from '../../../testing/api-urls';
import { ExplorePage } from './explore-page';
import { PLACE_SEARCH_DEBOUNCE_IN_MILLISECONDS } from './place-search';
import { childComponent, EIFFEL_TOWER_E5_URL, placeSearchInput } from './explore-page-test-helpers';

describe('ExplorePage on a phone', () => {
  let context: PageTestContext;

  afterEach(() => {
    vi.useRealTimers();
    context.httpTesting.verify();
    vi.restoreAllMocks();
    document.body.replaceChildren();
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

  /** Focus only reaches elements in the document. */
  const startSearch = async (element: HTMLElement) => {
    document.body.append(element);
    placeSearchInput(element).focus();
    await context.settle();
  };

  const isListShown = (element: HTMLElement): boolean =>
    element.querySelector('app-station-list')?.closest('[hidden]') === null;

  it('opens the sheet fully and shows the search instead of the list when the field is focused', async () => {
    const { fixture, element } = await renderWithStations();

    await startSearch(element);

    expect(childComponent(fixture, BottomSheet).snapPosition()).toBe('full');
    expect(isListShown(element)).toBe(false);
    const listbox = element.querySelector('[role="listbox"]');
    expect(listbox?.closest('.bottom-sheet__content')).not.toBeNull();
    expect(listbox?.closest('[hidden]')).not.toBeNull();
    expect(textOf(element.querySelector('.place-search-field__hint'))).toBe(
      'Ort, Adresse oder Postleitzahl in Frankreich eingeben.'
    );
    expect(element.querySelector('app-bottom-sheet a[aria-label="Einstellungen"]')).toBeNull();
    expect(getButton(element, 'Abbrechen')).toBeDefined();
  });

  it.each(['Abbrechen', 'Escape'] as const)(
    'returns to the previous position and the search center on %s',
    async action => {
      const { fixture, element } = await renderWithStations();
      const sheet = childComponent(fixture, BottomSheet);
      sheet.snapPosition.set('peek');
      await context.settle();
      await startSearch(element);
      const input = placeSearchInput(element);
      input.value = 'Bas';
      input.dispatchEvent(new Event('input'));
      await context.settle();

      if (action === 'Abbrechen') {
        getButton(element, 'Abbrechen').click();
      } else {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
      }
      await context.settle();

      expect(sheet.snapPosition()).toBe('peek');
      expect(input.value).toBe('');
      expect(document.activeElement).not.toBe(input);
      expect(isListShown(element)).toBe(true);
      expect(
        element.querySelector('app-bottom-sheet a[aria-label="Einstellungen"]')
      ).not.toBeNull();
    }
  );

  it('lowers the sheet to half when a place is chosen', async () => {
    const { fixture, element } = await renderWithStations();
    vi.useFakeTimers();
    await startSearch(element);
    const input = placeSearchInput(element);
    input.value = 'Bastille';
    input.dispatchEvent(new Event('input'));
    await context.settle();
    await vi.advanceTimersByTimeAsync(PLACE_SEARCH_DEBOUNCE_IN_MILLISECONDS);
    await context.settle();
    context.httpTesting.expectOne(placesUrl('Bastille')).flush([bastillePlace]);
    await context.settle();

    element.querySelector<HTMLElement>('[role="option"]')?.click();
    await context.settle();

    expect(childComponent(fixture, BottomSheet).snapPosition()).toBe('half');
    expect(isListShown(element)).toBe(true);
    context.httpTesting
      .expectOne(stationsUrl({ latitude: 48.8532, longitude: 2.3692 }))
      .flush([carrefourStation]);
    await context.settle();
    vi.useRealTimers();
  });

  it('hides the map controls while the fully opened sheet covers them', async () => {
    const { fixture, element } = await renderWithStations();
    const controls = element.querySelector('.explore-page__map-controls');

    childComponent(fixture, BottomSheet).snapPosition.set('full');
    await context.settle();
    expect(controls?.classList).toContain('explore-page__map-controls--covered');

    childComponent(fixture, BottomSheet).snapPosition.set('half');
    await context.settle();
    expect(controls?.classList).not.toContain('explore-page__map-controls--covered');
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

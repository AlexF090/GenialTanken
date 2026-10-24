import { TestBed } from '@angular/core/testing';
import type { Station } from '@genialtanken/contracts';
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
  essoStation,
  totalStation,
  unbrandedStation,
} from '../../../testing/station-fixtures';
import { bastillePlace } from '../../../testing/place-fixtures';
import { placesUrl, stationsUrl } from '../../../testing/api-urls';
import { ExplorePage } from './explore-page';
import { PLACE_SEARCH_DEBOUNCE_IN_MILLISECONDS } from './place-search';
import {
  childComponent,
  EIFFEL_TOWER_E5_URL,
  placeSearchInput,
  resultSummaryElement,
} from './explore-page-test-helpers';

describe('ExplorePage on a phone', () => {
  let context: PageTestContext;
  let fakeMatchMedia: FakeMatchMedia;

  afterEach(() => {
    vi.useRealTimers();
    context.httpTesting.verify();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  beforeEach(() => {
    fakeMatchMedia = new FakeMatchMedia([COMPACT_MEDIA_QUERY]);
    TestBed.overrideProvider(MATCH_MEDIA, { useValue: fakeMatchMedia.matchMedia });
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
    'returns to the previous position and the search center on %s and dismisses the keyboard',
    async action => {
      fakeMatchMedia.setMatches(TOUCH_DEVICE_MEDIA_QUERY, true);
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
      expect(document.activeElement).toBe(resultSummaryElement(element));
      expect(isListShown(element)).toBe(true);
      expect(
        element.querySelector('app-bottom-sheet a[aria-label="Einstellungen"]')
      ).not.toBeNull();
    }
  );

  it('lowers the sheet to half and dismisses the keyboard when a place is chosen', async () => {
    fakeMatchMedia.setMatches(TOUCH_DEVICE_MEDIA_QUERY, true);
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
    expect(document.activeElement).toBe(resultSummaryElement(element));
    context.httpTesting
      .expectOne(stationsUrl({ latitude: 48.8532, longitude: 2.3692 }))
      .flush([carrefourStation]);
    await context.settle();
    vi.useRealTimers();
  });

  it('zooms the map with buttons below the locate button', async () => {
    const { fixture, element } = await renderWithStations();
    const stationsMap = childComponent(fixture, StationsMap);
    const zoomIn = vi.spyOn(stationsMap, 'zoomIn');
    const zoomOut = vi.spyOn(stationsMap, 'zoomOut');
    const zoomGroup = element.querySelector<HTMLElement>(
      '.explore-page__map-controls [role="group"][aria-label="Zoom"]'
    );
    if (zoomGroup === null) {
      throw new Error('No zoom buttons');
    }

    getButton(zoomGroup, 'Hineinzoomen').click();
    getButton(zoomGroup, 'Herauszoomen').click();

    expect(zoomIn).toHaveBeenCalledOnce();
    expect(zoomOut).toHaveBeenCalledOnce();
  });

  it('marks "Hineinzoomen" unavailable at the maximum zoom and ignores it there', async () => {
    const { fixture, element } = await renderWithStations();
    const stationsMap = childComponent(fixture, StationsMap);
    const zoomInButton = getButton(element, 'Hineinzoomen');
    expect(zoomInButton.hasAttribute('aria-disabled')).toBe(false);

    // Zooms in step by step until the map reaches its maximum.
    await vi.waitFor(
      async () => {
        zoomInButton.click();
        await context.settle();
        expect(zoomInButton.getAttribute('aria-disabled')).toBe('true');
      },
      { timeout: 5000, interval: 10 }
    );
    const zoomIn = vi.spyOn(stationsMap, 'zoomIn');
    zoomInButton.click();

    // Stays in the tab order, so the focus does not jump away at the end of the range.
    expect(zoomInButton.disabled).toBe(false);
    expect(zoomIn).not.toHaveBeenCalled();
    expect(getButton(element, 'Herauszoomen').hasAttribute('aria-disabled')).toBe(false);
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

  it('does not suggest the home screen without a browser that supports it', async () => {
    const { element } = await renderComponent(ExplorePage);
    await context.settle();
    context.httpTesting
      .expectOne(EIFFEL_TOWER_E5_URL)
      .flush([totalStation, carrefourStation, unbrandedStation, essoStation]);
    await context.settle();

    expect(element.querySelector('app-installation-hint-banner')).toBeNull();
    expect(element.querySelectorAll('app-station-list ul')).toHaveLength(1);
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

  const render = async (stations: readonly Station[] = [totalStation]) => {
    const rendered = await renderComponent(ExplorePage);
    await context.settle();
    context.httpTesting.expectOne(EIFFEL_TOWER_E5_URL).flush(stations);
    await context.settle();
    return rendered;
  };

  const fourStations: readonly Station[] = [
    totalStation,
    carrefourStation,
    unbrandedStation,
    essoStation,
  ];

  const dismiss = async (element: HTMLElement) => {
    document.body.append(element);
    const dismissButton = getButton(element, 'Hinweis schließen');
    dismissButton.focus();
    dismissButton.click();
    await context.settle();
  };

  it('suggests adding the app to the home screen after the list of a few stations', async () => {
    const { element } = await render();

    const hint = element.querySelector('app-installation-hint-banner');
    expect(textOf(hint?.querySelector('h2'))).toBe('GenialTanken als App');
    expect(hint?.previousElementSibling?.getAttribute('aria-label')).toBe('Tankstellen');
    expect(hint?.nextElementSibling).toBeNull();
  });

  it('suggests it after the third station of a longer list, so the first ones stay in view', async () => {
    const { element } = await render(fourStations);

    const hint = element.querySelector('app-installation-hint-banner');
    expect(hint?.previousElementSibling?.querySelectorAll('li')).toHaveLength(3);
    expect(hint?.nextElementSibling?.getAttribute('aria-label')).toBe('Weitere Tankstellen');
  });

  it('does not suggest it while the first stations load, so it never jumps below them', async () => {
    const { element } = await renderComponent(ExplorePage);
    await context.settle();

    expect(element.querySelector('app-skeleton-rows')).not.toBeNull();
    expect(element.querySelector('app-installation-hint-banner')).toBeNull();

    context.httpTesting.expectOne(EIFFEL_TOWER_E5_URL).flush([totalStation]);
    await context.settle();
    expect(element.querySelector('app-installation-hint-banner')).not.toBeNull();
  });

  it('closes the suggestion for good', async () => {
    const { element } = await render();

    await dismiss(element);

    expect(element.querySelector('app-installation-hint-banner')).toBeNull();
    expect(context.storage.getItem(INSTALLATION_HINT_STORAGE_KEY)).toBe('dismissed');
    // The closed hint took the focus with it; it continues right after it, at the credit.
    expect(document.activeElement).toBe(element.querySelector('app-data-source-credit a'));
    document.body.replaceChildren();
  });

  it('continues at the station after the closed suggestion', async () => {
    const { element } = await render(fourStations);

    await dismiss(element);

    // The list is whole again; the station that followed the hint has the focus.
    expect(element.querySelectorAll('app-station-list ul')).toHaveLength(1);
    expect(document.activeElement).toBe(
      element.querySelectorAll('app-station-list .station-row__title')[3]
    );
    document.body.replaceChildren();
  });
});

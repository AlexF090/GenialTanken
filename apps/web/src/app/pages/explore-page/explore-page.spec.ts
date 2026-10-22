import { TestBed } from '@angular/core/testing';
import { SearchCenterStore } from '../../core/search-center/search-center-store';
import { SettingsStore } from '../../core/settings/settings-store';
import { StationsMap } from '../../ui/stations-map/stations-map';
import { FakeStorage, storedFavorites } from '../../../testing/fake-storage';
import { bastillePlace } from '../../../testing/place-fixtures';
import {
  configurePageTest,
  getButton,
  renderComponent,
  stationTitles,
  textOf,
} from '../../../testing/render-page';
import type { PageTestContext } from '../../../testing/render-page';
import {
  carrefourStation,
  totalStation,
  unbrandedStation,
} from '../../../testing/station-fixtures';
import { ExplorePage } from './explore-page';
import { PLACE_SEARCH_DEBOUNCE_IN_MILLISECONDS } from './place-search';
import { PLACES_URL, placesUrl, stationsUrl } from '../../../testing/api-urls';
import { SETTINGS_STORAGE_KEY } from '../../core/settings/settings-store';
import {
  childComponent,
  EIFFEL_TOWER_E5_URL,
  placeSearchInput,
  selectedStationTitles,
} from './explore-page-test-helpers';

/** Needs fake timers: lets the debounce of the place search pass. */
const waitForTypingPause = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(PLACE_SEARCH_DEBOUNCE_IN_MILLISECONDS);
};

describe('ExplorePage', () => {
  let context: PageTestContext;

  const renderWithStations = async () => {
    const rendered = await renderComponent(ExplorePage);
    await context.settle();
    context.httpTesting
      .expectOne(EIFFEL_TOWER_E5_URL)
      .flush([totalStation, carrefourStation, unbrandedStation]);
    await context.settle();
    return rendered;
  };

  beforeEach(() => {
    context = configurePageTest();
  });

  afterEach(() => {
    vi.useRealTimers();
    context.httpTesting.verify();
    vi.restoreAllMocks();
  });

  it('renders one main landmark with the application name as heading', async () => {
    const { element } = await renderComponent(ExplorePage);

    expect(element.querySelectorAll('main')).toHaveLength(1);
    expect(textOf(element.querySelector('main h1'))).toBe('GenialTanken');
    context.httpTesting.expectOne(EIFFEL_TOWER_E5_URL);
  });

  it('reaches the controls and the list before the map', async () => {
    const { element } = await renderWithStations();

    const list = element.querySelector('main ul');
    const map = element.querySelector('app-stations-map');
    expect(list?.compareDocumentPosition(map as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('lists the stations around the Eiffel Tower without locating the user', async () => {
    const { element } = await renderWithStations();

    expect(stationTitles(element)).toEqual([
      'TotalEnergies',
      'Carrefour Market',
      '40 Avenue de Flandre',
    ]);
    expect(context.geolocation.pendingRequestCount).toBe(0);
  });

  it('summarizes the result with count, radius and search center', async () => {
    const { element } = await renderWithStations();

    expect(textOf(element.querySelector('main app-bottom-sheet [role="status"]'))).toBe(
      '3 Tankstellen im Umkreis von 5 km um Eiffelturm, Paris'
    );
  });

  it('uses the singular for a single station', async () => {
    const { element } = await renderComponent(ExplorePage);
    await context.settle();
    context.httpTesting.expectOne(EIFFEL_TOWER_E5_URL).flush([totalStation]);
    await context.settle();

    expect(textOf(element.querySelector('main app-bottom-sheet [role="status"]'))).toBe(
      '1 Tankstelle im Umkreis von 5 km um Eiffelturm, Paris'
    );
  });

  it('names the fuel type on a menu button', async () => {
    const { element } = await renderWithStations();

    const fuelButton = getButton(element, 'Kraftstoff: E5');
    expect(fuelButton.getAttribute('aria-haspopup')).toBe('menu');
    expect(textOf(fuelButton.querySelector('.visually-hidden'))).toBe('Kraftstoff:');
  });

  it('fetches with the fuel type chosen in the fuel menu and remembers it', async () => {
    const { element } = await renderWithStations();

    getButton(element, 'Kraftstoff: E5').click();
    await context.settle();
    const menu = element.querySelector('[role="menu"][aria-label="Kraftstoff"]');
    const items = [...(menu?.querySelectorAll('[role="menuitemradio"]') ?? [])];
    expect(items.map(item => textOf(item))).toEqual([
      'Super E5',
      'Super E10',
      'Super Plus',
      'Diesel',
      'E85',
      'LPG',
    ]);
    getButton(element, 'Diesel').click();
    await context.settle();

    context.httpTesting
      .expectOne(stationsUrl({ latitude: 48.8584, longitude: 2.2945 }, { fuel: 'diesel' }))
      .flush([carrefourStation]);
    await context.settle();
    expect(getButton(element, 'Kraftstoff: Diesel')).toBeDefined();
    expect(TestBed.inject(SettingsStore).fuelType()).toBe('diesel');
  });

  it('offers the radius steps in a menu inside the search field', async () => {
    const { element } = await renderWithStations();

    const radiusButton = getButton(element, 'Radius: 5 km');
    expect(radiusButton.closest('[role="search"]')).not.toBeNull();
    radiusButton.click();
    await context.settle();
    const items = [
      ...element.querySelectorAll('[role="menu"][aria-label="Radius"] [role="menuitemradio"]'),
    ];
    expect(items.map(item => textOf(item))).toEqual([
      '1 km',
      '2 km',
      '5 km',
      '10 km',
      '15 km',
      '25 km',
      '30 km',
    ]);

    getButton(element, '10 km').click();
    await context.settle();

    context.httpTesting
      .expectOne(stationsUrl({ latitude: 48.8584, longitude: 2.2945 }, { radiusInKilometers: 10 }))
      .flush([totalStation]);
    await context.settle();
    expect(getButton(element, 'Radius: 10 km')).toBeDefined();
    expect(TestBed.inject(SettingsStore).radiusInKilometers()).toBe(10);
  });

  it('shows "Position auf Karte" in the empty search field', async () => {
    const { element } = await renderWithStations();

    expect(placeSearchInput(element).placeholder).toBe('Position auf Karte');
    expect(placeSearchInput(element).value).toBe('');
  });

  it('searches places after a typing pause and moves to the chosen one', async () => {
    const { fixture, element } = await renderWithStations();
    vi.useFakeTimers();
    const input = placeSearchInput(element);

    input.value = 'Bastille';
    input.dispatchEvent(new Event('input'));
    await context.settle();
    await vi.advanceTimersByTimeAsync(PLACE_SEARCH_DEBOUNCE_IN_MILLISECONDS - 1);
    context.httpTesting.expectNone(() => true);
    await vi.advanceTimersByTimeAsync(1);
    await context.settle();
    context.httpTesting.expectOne(placesUrl('Bastille')).flush([bastillePlace]);
    await context.settle();
    await fixture.whenStable();

    const option = element.querySelector<HTMLElement>('[role="option"]');
    expect(textOf(option)).toBe('Place de la Bastille, 75011 Paris, Frankreich');
    option?.click();
    await context.settle();

    context.httpTesting
      .expectOne(stationsUrl({ latitude: 48.8532, longitude: 2.3692 }))
      .flush([carrefourStation]);
    await context.settle();
    expect(input.value).toBe('Place de la Bastille');
    expect(element.querySelector('[role="option"]')).toBeNull();
    expect(textOf(element.querySelector('main app-bottom-sheet [role="status"]'))).toBe(
      '1 Tankstelle im Umkreis von 5 km um Place de la Bastille'
    );
    await waitForTypingPause();
    context.httpTesting.expectNone(request => request.url === PLACES_URL);
  });

  it('tells when no place matches and when the place search fails', async () => {
    const { element } = await renderWithStations();
    vi.useFakeTimers();
    const input = placeSearchInput(element);
    const typeAndWait = async (query: string) => {
      input.value = query;
      input.dispatchEvent(new Event('input'));
      await context.settle();
      await waitForTypingPause();
      await context.settle();
    };

    await typeAndWait('Xyzzy');
    context.httpTesting.expectOne(placesUrl('Xyzzy')).flush([]);
    await context.settle();
    expect(textOf(element.querySelector('.place-search-field__status'))).toBe(
      'Keine passenden Orte gefunden.'
    );

    await typeAndWait('Xyzzyx');
    context.httpTesting
      .expectOne(placesUrl('Xyzzyx'))
      .flush(null, { status: 502, statusText: 'Bad Gateway' });
    await context.settle();
    expect(textOf(element.querySelector('.place-search-field__status'))).toBe(
      'Die Ortssuche ist gerade nicht erreichbar.'
    );
  });

  it('keeps searching around the place but drops its name when the search is cleared', async () => {
    const { element } = await renderWithStations();
    TestBed.inject(SearchCenterStore).usePlace(bastillePlace);
    await context.settle();
    context.httpTesting
      .expectOne(stationsUrl({ latitude: 48.8532, longitude: 2.3692 }))
      .flush([carrefourStation]);
    await context.settle();

    getButton(element, 'Suche löschen').click();
    await context.settle();

    context.httpTesting.expectNone(() => true);
    expect(placeSearchInput(element).value).toBe('');
    expect(textOf(element.querySelector('main app-bottom-sheet [role="status"]'))).toBe(
      '1 Tankstelle im Umkreis von 5 km um die Kartenmitte'
    );
  });

  it('credits the price data source in a new tab', async () => {
    const { element } = await renderWithStations();

    const credit = element.querySelector('main a[href="https://www.prix-carburants.gouv.fr/"]');
    expect(textOf(credit)).toBe('Preisdaten: prix-carburants.gouv.fr (öffnet in neuem Tab)');
  });

  it('switches between distance order and ascending price', async () => {
    const { element } = await renderWithStations();
    const radio = (name: string): HTMLInputElement => {
      const input = [...element.querySelectorAll('fieldset label')]
        .find(label => textOf(label) === name)
        ?.querySelector('input');
      if (input === null || input === undefined) {
        throw new Error(`No radio named ${name}`);
      }
      return input;
    };
    expect(textOf(element.querySelector('fieldset legend'))).toBe('Sortierung');
    expect(radio('Entfernung').checked).toBe(true);

    radio('Preis').click();
    await context.settle();

    expect(stationTitles(element)).toEqual([
      '40 Avenue de Flandre',
      'Carrefour Market',
      'TotalEnergies',
    ]);

    radio('Entfernung').click();
    await context.settle();

    expect(stationTitles(element)).toEqual([
      'TotalEnergies',
      'Carrefour Market',
      '40 Avenue de Flandre',
    ]);
  });

  it('labels the cheapest station', async () => {
    const { element } = await renderWithStations();

    const cheapestItems = [...element.querySelectorAll('main li')].filter(item =>
      textOf(item).includes('Günstigster Preis')
    );
    expect(cheapestItems.map(item => textOf(item.querySelector('.station-row__title')))).toEqual([
      '40 Avenue de Flandre',
    ]);
  });

  it('fetches again with the new fuel type and radius after the settings change', async () => {
    const { element } = await renderWithStations();

    TestBed.inject(SettingsStore).update({ fuelType: 'diesel', radiusInKilometers: 10 });
    await context.settle();

    context.httpTesting
      .expectOne(
        stationsUrl(
          { latitude: 48.8584, longitude: 2.2945 },
          { radiusInKilometers: 10, fuel: 'diesel' }
        )
      )
      .flush([carrefourStation]);
    await context.settle();
    expect(stationTitles(element)).toEqual(['Carrefour Market']);
    expect(textOf(element.querySelector('main li'))).toContain('1,669 €');
    expect(getButton(element, 'Kraftstoff: Diesel')).toBeDefined();
  });

  it('requests fresh prices once on "Aktualisieren"', async () => {
    const { element } = await renderWithStations();

    getButton(element, 'Aktualisieren').click();
    await context.settle();

    const requests = context.httpTesting.match(() => true);
    expect(requests.map(request => request.request.urlWithParams)).toEqual([EIFFEL_TOWER_E5_URL]);
    requests[0]?.flush([totalStation]);
    await context.settle();
    expect(stationTitles(element)).toEqual(['TotalEnergies']);
  });

  it('locates the user on "Meinen Standort verwenden" and searches around the position', async () => {
    const { element } = await renderWithStations();
    const locateButton = getButton(element, 'Meinen Standort verwenden');

    locateButton.click();
    await context.settle();

    expect(context.geolocation.pendingRequestCount).toBe(1);
    expect(locateButton.getAttribute('aria-busy')).toBe('true');
    expect(locateButton.getAttribute('aria-disabled')).toBe('true');
    locateButton.click();
    expect(context.geolocation.pendingRequestCount).toBe(1);

    context.geolocation.resolvePosition(48.85, 2.35);
    await context.settle();

    context.httpTesting
      .expectOne(stationsUrl({ latitude: 48.85, longitude: 2.35 }))
      .flush([carrefourStation]);
    await context.settle();
    expect(stationTitles(element)).toEqual(['Carrefour Market']);
    expect(textOf(element.querySelector('main app-bottom-sheet [role="status"]'))).toBe(
      '1 Tankstelle im Umkreis von 5 km um Dein Standort'
    );
    expect(locateButton.getAttribute('aria-busy')).toBe('false');
    expect(locateButton.classList).toContain('explore-page__locate--active');
    expect(placeSearchInput(element).placeholder).toBe('Dein Standort');
  });

  it('explains a denied location and keeps the Eiffel Tower results', async () => {
    const { element } = await renderWithStations();

    getButton(element, 'Meinen Standort verwenden').click();
    await context.settle();
    context.geolocation.rejectWithPermissionDenied();
    await context.settle();

    expect(textOf(element.querySelector('main [role="alert"]'))).toContain(
      'Der Zugriff auf deinen Standort wurde verweigert.'
    );
    expect(stationTitles(element)).toHaveLength(3);

    getButton(element, 'Hinweis schließen').click();
    await context.settle();

    expect(element.querySelector('main [role="alert"]')).toBeNull();
  });

  it('stars a station and persists it', async () => {
    const { element } = await renderWithStations();

    getButton(element, 'Favorit: Carrefour Market').click();
    await context.settle();

    expect(storedFavorites(context.storage)).toBe('["fr-75005002"]');
    expect(getButton(element, 'Favorit: Carrefour Market').getAttribute('aria-pressed')).toBe(
      'true'
    );
  });

  it('offers a search in the area the map was moved to and searches there', async () => {
    const { fixture, element } = await renderWithStations();
    const map = childComponent(fixture, StationsMap);
    const areaSearchButton = () =>
      [...element.querySelectorAll('button')].find(
        button => textOf(button) === 'In diesem Bereich suchen'
      );

    map.visibleCenterChanged.emit({ latitude: 48.8586, longitude: 2.2955 });
    await context.settle();
    expect(areaSearchButton()).toBeUndefined();

    map.visibleCenterChanged.emit({ latitude: 48.8532, longitude: 2.3692 });
    await context.settle();
    areaSearchButton()?.click();
    await context.settle();

    context.httpTesting
      .expectOne(stationsUrl({ latitude: 48.8532, longitude: 2.3692 }))
      .flush([carrefourStation]);
    await context.settle();
    expect(areaSearchButton()).toBeUndefined();
    expect(placeSearchInput(element).placeholder).toBe('Position auf Karte');
    expect(textOf(element.querySelector('main app-bottom-sheet [role="status"]'))).toBe(
      '1 Tankstelle im Umkreis von 5 km um die Kartenmitte'
    );
  });

  it('selects the station whose price tag was chosen on the map', async () => {
    const { element, fixture } = await renderWithStations();
    const map = childComponent(fixture, StationsMap);

    map.stationSelected.emit(carrefourStation.id);
    await context.settle();

    expect(selectedStationTitles(element)).toEqual(['Carrefour Market']);
    expect(map.selectedStationIdentifier()).toBe(carrefourStation.id);
  });

  it('shows the station of a chosen row on the map and centers it again on a second tap', async () => {
    const { element, fixture } = await renderWithStations();
    const map = childComponent(fixture, StationsMap);
    const revealSelectedStation = vi.spyOn(map, 'revealSelectedStation');

    getButton(element, 'TotalEnergies').click();
    await context.settle();
    expect(map.selectedStationIdentifier()).toBe(totalStation.id);
    expect(selectedStationTitles(element)).toEqual(['TotalEnergies']);
    expect(revealSelectedStation).not.toHaveBeenCalled();

    getButton(element, 'TotalEnergies').click();
    await context.settle();
    expect(map.selectedStationIdentifier()).toBe(totalStation.id);
    expect(revealSelectedStation).toHaveBeenCalledOnce();
  });

  it('links each row to the station details', async () => {
    const { element } = await renderWithStations();

    const detailsLink = element.querySelector('main a[aria-label="Details: TotalEnergies"]');
    expect(detailsLink?.getAttribute('href')).toBe(`/stations/${totalStation.id}`);
  });

  it('clears the selection when the station is gone after a refresh', async () => {
    const { element, fixture } = await renderWithStations();
    childComponent(fixture, StationsMap).stationSelected.emit(carrefourStation.id);
    await context.settle();

    getButton(element, 'Aktualisieren').click();
    await context.settle();
    context.httpTesting.expectOne(EIFFEL_TOWER_E5_URL).flush([totalStation]);
    await context.settle();

    expect(childComponent(fixture, StationsMap).selectedStationIdentifier()).toBeUndefined();
  });

  it('clears the selection when another place is chosen', async () => {
    const { fixture } = await renderWithStations();
    const map = childComponent(fixture, StationsMap);
    map.stationSelected.emit(totalStation.id);
    await context.settle();

    TestBed.inject(SearchCenterStore).usePlace(bastillePlace);
    await context.settle();

    expect(map.selectedStationIdentifier()).toBeUndefined();
    context.httpTesting
      .expectOne(stationsUrl({ latitude: 48.8532, longitude: 2.3692 }))
      .flush([totalStation]);
    await context.settle();
    expect(map.selectedStationIdentifier()).toBeUndefined();
  });

  it('reports an unavailable upstream API', async () => {
    const { element } = await renderComponent(ExplorePage);
    await context.settle();

    context.httpTesting
      .expectOne(EIFFEL_TOWER_E5_URL)
      .flush(
        { statusCode: 502, message: 'Upstream unavailable' },
        { status: 502, statusText: 'Bad Gateway' }
      );
    await context.settle();

    expect(textOf(element.querySelector('[role="alert"]'))).toBe(
      'Die Preisdaten sind gerade nicht erreichbar. Bitte versuche es später erneut.'
    );
  });

  it('reports a response that does not match the contract', async () => {
    const { element } = await renderComponent(ExplorePage);
    await context.settle();

    context.httpTesting.expectOne(EIFFEL_TOWER_E5_URL).flush({ unexpected: true });
    await context.settle();

    expect(textOf(element.querySelector('[role="alert"]'))).toBe(
      'Der Server hat unerwartete Daten geliefert. Bitte versuche es später erneut.'
    );
  });

  it('says so when no station is in range', async () => {
    const { element } = await renderComponent(ExplorePage);
    await context.settle();

    context.httpTesting.expectOne(EIFFEL_TOWER_E5_URL).flush([]);
    await context.settle();

    const emptyMessage = element.querySelector('main .explore-page__empty');
    expect(textOf(emptyMessage)).toBe(
      'Keine Tankstellen mit Preis für E5 im Umkreis von 5 km gefunden.'
    );
    // One live region, so screen readers announce the empty result once.
    expect(emptyMessage?.closest('[role="status"]')).toBeNull();
    const announcingRegions = [...element.querySelectorAll('main [role="status"]')].filter(region =>
      textOf(region).includes('Keine Tankstellen')
    );
    expect(announcingRegions.map(textOf)).toEqual([
      '0 Tankstellen im Umkreis von 5 km um Eiffelturm, Paris. Keine Tankstellen mit Preis für E5 im Umkreis von 5 km gefunden.',
    ]);
    expect(announcingRegions[0]?.querySelector('.visually-hidden')).not.toBeNull();
  });
});

describe('ExplorePage with stored settings', () => {
  it('uses the persisted fuel type and radius for the first request', async () => {
    const context = configurePageTest({
      storage: new FakeStorage({
        [SETTINGS_STORAGE_KEY]: '{"fuelType":"e10","radiusInKilometers":15}',
      }),
    });
    await renderComponent(ExplorePage);
    await context.settle();

    context.httpTesting
      .expectOne(
        stationsUrl(
          { latitude: 48.8584, longitude: 2.2945 },
          { radiusInKilometers: 15, fuel: 'e10' }
        )
      )
      .flush([]);
    context.httpTesting.verify();
  });
});

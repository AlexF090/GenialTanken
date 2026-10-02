import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { COMPACT_MEDIA_QUERY } from '../../core/layout/breakpoints';
import { MATCH_MEDIA } from '../../core/layout/media-query';
import { SearchCenterStore } from '../../core/search-center/search-center-store';
import { SettingsStore } from '../../core/settings/settings-store';
import { BottomSheet } from '../../ui/bottom-sheet/bottom-sheet';
import { StationsMap } from '../../ui/stations-map/stations-map';
import { FakeMatchMedia } from '../../../testing/fake-match-media';
import { FakeStorage } from '../../../testing/fake-storage';
import { bastillePlace } from '../../../testing/place-fixtures';
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

const EIFFEL_TOWER_E5_URL =
  '/api/stations?latitude=48.8584&longitude=2.2945&radiusInKilometers=5&fuel=e5';

const stationTitles = (element: HTMLElement): string[] =>
  [...element.querySelectorAll('main li a')].map(title => textOf(title));

const selectedStationTitles = (element: HTMLElement): string[] =>
  [...element.querySelectorAll('main li[data-station-id]')]
    .filter(row => row.querySelector('button[aria-pressed="true"]') !== null)
    .map(row => textOf(row.querySelector('a')));

const childComponent = <T>(
  fixture: ComponentFixture<unknown>,
  type: new (...args: never[]) => T
): T => fixture.debugElement.query(By.directive(type)).componentInstance as T;

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

    expect(textOf(element.querySelector('main [role="status"]'))).toBe(
      '3 Tankstellen im Umkreis von 5 km um Eiffelturm, Paris'
    );
  });

  it('uses the singular for a single station', async () => {
    const { element } = await renderComponent(ExplorePage);
    await context.settle();
    context.httpTesting.expectOne(EIFFEL_TOWER_E5_URL).flush([totalStation]);
    await context.settle();

    expect(textOf(element.querySelector('main [role="status"]'))).toBe(
      '1 Tankstelle im Umkreis von 5 km um Eiffelturm, Paris'
    );
  });

  it('links the fuel type to the settings', async () => {
    const { element } = await renderWithStations();

    const fuelLink = element.querySelector('main a[href="/settings"]');
    expect(textOf(fuelLink)).toBe('Kraftstoff: E5');
    expect(textOf(fuelLink?.querySelector('.visually-hidden'))).toBe('Kraftstoff:');
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
    expect(cheapestItems.map(item => textOf(item.querySelector('a')))).toEqual([
      '40 Avenue de Flandre',
    ]);
  });

  it('fetches again with the new fuel type and radius after the settings change', async () => {
    const { element } = await renderWithStations();

    TestBed.inject(SettingsStore).update({ fuelType: 'diesel', radiusInKilometers: 10 });
    await context.settle();

    context.httpTesting
      .expectOne(
        '/api/stations?latitude=48.8584&longitude=2.2945&radiusInKilometers=10&fuel=diesel'
      )
      .flush([carrefourStation]);
    await context.settle();
    expect(stationTitles(element)).toEqual(['Carrefour Market']);
    expect(textOf(element.querySelector('main li'))).toContain('1,669 €');
    expect(textOf(element.querySelector('main a[href="/settings"]'))).toBe('Kraftstoff: Diesel');
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
      .expectOne('/api/stations?latitude=48.85&longitude=2.35&radiusInKilometers=5&fuel=e5')
      .flush([carrefourStation]);
    await context.settle();
    expect(stationTitles(element)).toEqual(['Carrefour Market']);
    expect(textOf(element.querySelector('main [role="status"]'))).toBe(
      '1 Tankstelle im Umkreis von 5 km um Dein Standort'
    );
    expect(locateButton.getAttribute('aria-busy')).toBe('false');
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
  });

  it('stars a station and persists it', async () => {
    const { element } = await renderWithStations();

    getButton(element, 'Favorit: Carrefour Market').click();
    await context.settle();

    expect(context.storage.getItem('favoriteIDs')).toBe('["fr-75005002"]');
    expect(getButton(element, 'Favorit: Carrefour Market').getAttribute('aria-pressed')).toBe(
      'true'
    );
  });

  it('selects the station whose price tag was chosen on the map', async () => {
    const { element, fixture } = await renderWithStations();
    const map = childComponent(fixture, StationsMap);

    map.stationSelected.emit(carrefourStation.id);
    await context.settle();

    expect(selectedStationTitles(element)).toEqual(['Carrefour Market']);
    expect(map.selectedStationId()).toBe(carrefourStation.id);
  });

  it('shows a station from the list on the map and toggles it off again', async () => {
    const { element, fixture } = await renderWithStations();
    const map = childComponent(fixture, StationsMap);

    getButton(element, 'Auf Karte zeigen: TotalEnergies').click();
    await context.settle();
    expect(map.selectedStationId()).toBe(totalStation.id);
    expect(selectedStationTitles(element)).toEqual(['TotalEnergies']);

    getButton(element, 'Auf Karte zeigen: TotalEnergies').click();
    await context.settle();
    expect(map.selectedStationId()).toBeUndefined();
  });

  it('clears the selection when the station is gone after a refresh', async () => {
    const { element, fixture } = await renderWithStations();
    childComponent(fixture, StationsMap).stationSelected.emit(carrefourStation.id);
    await context.settle();

    getButton(element, 'Aktualisieren').click();
    await context.settle();
    context.httpTesting.expectOne(EIFFEL_TOWER_E5_URL).flush([totalStation]);
    await context.settle();

    expect(childComponent(fixture, StationsMap).selectedStationId()).toBeUndefined();
  });

  it('clears the selection when another place is chosen', async () => {
    const { fixture } = await renderWithStations();
    const map = childComponent(fixture, StationsMap);
    map.stationSelected.emit(totalStation.id);
    await context.settle();

    TestBed.inject(SearchCenterStore).usePlace(bastillePlace);
    await context.settle();

    expect(map.selectedStationId()).toBeUndefined();
    context.httpTesting
      .expectOne('/api/stations?latitude=48.8532&longitude=2.3692&radiusInKilometers=5&fuel=e5')
      .flush([totalStation]);
    await context.settle();
    expect(map.selectedStationId()).toBeUndefined();
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

    expect(textOf(element.querySelector('main .message'))).toBe(
      'Keine Tankstellen mit Preis für E5 im Umkreis von 5 km gefunden.'
    );
    expect(textOf(element.querySelector('main [role="status"]'))).toBe(
      '0 Tankstellen im Umkreis von 5 km um Eiffelturm, Paris'
    );
  });
});

describe('ExplorePage on a phone', () => {
  let context: PageTestContext;

  afterEach(() => {
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

  it('lowers the sheet to peek so the map shows the station from the list', async () => {
    const { element, fixture } = await renderWithStations();
    const sheet = childComponent(fixture, BottomSheet);
    sheet.snapPosition.set('full');
    await context.settle();

    getButton(element, 'Auf Karte zeigen: Carrefour Market').click();
    await context.settle();

    expect(sheet.snapPosition()).toBe('peek');
    expect(childComponent(fixture, StationsMap).selectedStationId()).toBe(carrefourStation.id);
  });
});

describe('ExplorePage with stored settings', () => {
  it('uses the persisted fuel type and radius for the first request', async () => {
    const context = configurePageTest({
      storage: new FakeStorage({
        'genialtanken.settings': '{"fuelType":"e10","radiusInKilometers":15}',
      }),
    });
    await renderComponent(ExplorePage);
    await context.settle();

    context.httpTesting
      .expectOne('/api/stations?latitude=48.8584&longitude=2.2945&radiusInKilometers=15&fuel=e10')
      .flush([]);
    context.httpTesting.verify();
  });
});

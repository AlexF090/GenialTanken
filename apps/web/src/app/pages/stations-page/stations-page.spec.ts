import { TestBed } from '@angular/core/testing';
import { SettingsStore } from '../../core/settings/settings-store';
import { FakeStorage } from '../../../testing/fake-storage';
import {
  configurePageTest,
  getButton,
  renderComponent,
  textOf,
} from '../../../testing/render-page';
import type { PageTestContext } from '../../../testing/render-page';
import {
  carrefourStation,
  PARIS,
  totalStation,
  unbrandedStation,
} from '../../../testing/station-fixtures';
import { StationsPage } from './stations-page';

const PARIS_E5_URL = '/api/stations?latitude=48.8566&longitude=2.3522&radiusInKilometers=5&fuel=e5';

const stationTitles = (element: HTMLElement): string[] =>
  [...element.querySelectorAll('main li .station-card__title')].map(title => textOf(title));

describe('StationsPage', () => {
  let context: PageTestContext;

  const renderWithStations = async () => {
    const rendered = await renderComponent(StationsPage);
    context.geolocation.resolvePosition(PARIS.latitude, PARIS.longitude);
    await context.settle();
    context.httpTesting
      .expectOne(PARIS_E5_URL)
      .flush([totalStation, carrefourStation, unbrandedStation]);
    await context.settle();
    return rendered;
  };

  beforeEach(() => {
    context = configurePageTest();
  });

  afterEach(() => {
    context.httpTesting.verify();
  });

  it('shows the title and the selected fuel type in the header', async () => {
    const { element } = await renderComponent(StationsPage);

    expect(textOf(element.querySelector('header h1'))).toBe('GenialTanken');
    expect(textOf(element.querySelector('header .page-header__fuel'))).toBe('Kraftstoff: E5');
  });

  it('lists the stations around the current position', async () => {
    const { element } = await renderWithStations();

    expect(stationTitles(element)).toEqual([
      'TotalEnergies',
      'Carrefour Market',
      '40 Avenue de Flandre',
    ]);
  });

  it('toggles between distance order and ascending price', async () => {
    const { element } = await renderWithStations();
    const sortButton = getButton(element, /^Sortiert nach:/);
    expect(textOf(sortButton)).toBe('Sortiert nach: km');

    sortButton.click();
    await context.settle();

    expect(textOf(sortButton)).toBe('Sortiert nach: Preis');
    expect(stationTitles(element)).toEqual([
      '40 Avenue de Flandre',
      'Carrefour Market',
      'TotalEnergies',
    ]);

    sortButton.click();
    await context.settle();

    expect(stationTitles(element)).toEqual([
      'TotalEnergies',
      'Carrefour Market',
      '40 Avenue de Flandre',
    ]);
  });

  it('fetches again with the new fuel type and radius after the settings change', async () => {
    const { element } = await renderWithStations();

    TestBed.inject(SettingsStore).update({ fuelType: 'diesel', radiusInKilometers: 10 });
    await context.settle();

    context.httpTesting
      .expectOne(
        '/api/stations?latitude=48.8566&longitude=2.3522&radiusInKilometers=10&fuel=diesel'
      )
      .flush([carrefourStation]);
    await context.settle();
    expect(textOf(element.querySelector('header .page-header__fuel'))).toBe('Kraftstoff: Diesel');
    expect(stationTitles(element)).toEqual(['Carrefour Market']);
    expect(textOf(element.querySelector('main li'))).toContain('1,669 €');
  });

  it('relocates and fetches fresh prices on "Aktualisieren"', async () => {
    const { element } = await renderWithStations();

    getButton(element, 'Aktualisieren').click();
    await context.settle();
    context.httpTesting.expectOne(PARIS_E5_URL).flush([totalStation]);
    context.geolocation.resolvePosition(48.85, 2.35);
    await context.settle();

    context.httpTesting
      .expectOne('/api/stations?latitude=48.85&longitude=2.35&radiusInKilometers=5&fuel=e5')
      .flush([carrefourStation]);
    await context.settle();
    expect(stationTitles(element)).toEqual(['Carrefour Market']);
  });

  it('stars a station and persists it', async () => {
    const { element } = await renderWithStations();

    getButton(element, 'Zu Favoriten hinzufügen: Carrefour Market').click();
    await context.settle();

    expect(context.storage.getItem('favoriteIDs')).toBe('["fr-75005002"]');
    expect(
      getButton(element, 'Aus Favoriten entfernen: Carrefour Market').getAttribute('aria-pressed')
    ).toBe('true');
  });

  it('explains a denied location permission', async () => {
    const { element } = await renderComponent(StationsPage);

    context.geolocation.rejectWithPermissionDenied();
    await context.settle();

    expect(textOf(element.querySelector('[role="alert"]'))).toBe(
      'Der Zugriff auf deinen Standort wurde verweigert. Erlaube ihn in den Einstellungen deines Browsers, um Tankstellen in deiner Nähe zu sehen.'
    );
  });

  it('reports an unavailable upstream API', async () => {
    const { element } = await renderComponent(StationsPage);
    context.geolocation.resolvePosition(PARIS.latitude, PARIS.longitude);
    await context.settle();

    context.httpTesting
      .expectOne(PARIS_E5_URL)
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
    const { element } = await renderComponent(StationsPage);
    context.geolocation.resolvePosition(PARIS.latitude, PARIS.longitude);
    await context.settle();

    context.httpTesting.expectOne(PARIS_E5_URL).flush({ unexpected: true });
    await context.settle();

    expect(textOf(element.querySelector('[role="alert"]'))).toBe(
      'Der Server hat unerwartete Daten geliefert. Bitte versuche es später erneut.'
    );
  });

  it('says so when no station is in range', async () => {
    const { element } = await renderComponent(StationsPage);
    context.geolocation.resolvePosition(PARIS.latitude, PARIS.longitude);
    await context.settle();

    context.httpTesting.expectOne(PARIS_E5_URL).flush([]);
    await context.settle();

    expect(textOf(element.querySelector('main .message'))).toBe(
      'Keine Tankstellen mit Preis für E5 im Umkreis von 5 km gefunden.'
    );
  });
});

describe('StationsPage with stored settings', () => {
  it('uses the persisted fuel type and radius for the first request', async () => {
    const context = configurePageTest({
      storage: new FakeStorage({
        'genialtanken.settings': '{"fuelType":"e10","radiusInKilometers":15}',
      }),
    });
    await renderComponent(StationsPage);

    context.geolocation.resolvePosition(PARIS.latitude, PARIS.longitude);
    await context.settle();

    context.httpTesting
      .expectOne('/api/stations?latitude=48.8566&longitude=2.3522&radiusInKilometers=15&fuel=e10')
      .flush([]);
    context.httpTesting.verify();
  });
});

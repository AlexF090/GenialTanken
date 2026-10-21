import { FakeStorage } from '../../../testing/fake-storage';
import {
  configurePageTest,
  getButton,
  renderComponent,
  textOf,
} from '../../../testing/render-page';
import type { PageTestContext } from '../../../testing/render-page';
import { carrefourStation, totalStation, withoutDistance } from '../../../testing/station-fixtures';
import { FavoritesPage } from './favorites-page';

const BAD_GATEWAY = { status: 502, statusText: 'Bad Gateway' };
const BAD_GATEWAY_BODY = { statusCode: 502, message: 'Upstream unavailable' };

const lookupUrl = (identifiers: string): string =>
  `/api/stations/by-identifiers?identifiers=${identifiers}`;

const stationTitles = (element: HTMLElement): string[] =>
  [...element.querySelectorAll('main li a')].map(title => textOf(title));

describe('FavoritesPage', () => {
  let context: PageTestContext;

  afterEach(() => {
    context.httpTesting.verify();
  });

  it('shows an empty state without favorites and sends no request', async () => {
    context = configurePageTest();

    const { element } = await renderComponent(FavoritesPage);
    await context.settle();

    expect(textOf(element.querySelector('header h1'))).toBe('Favoriten');
    expect(textOf(element.querySelector('main h2'))).toBe('Keine Favoriten gespeichert');
    const exploreLink = [...element.querySelectorAll('main a')].find(
      link => textOf(link) === 'Tankstellen erkunden'
    );
    expect(exploreLink?.getAttribute('href')).toBe('/');
    expect(element.querySelector('app-data-source-credit')).toBeNull();
  });

  const renderWithTwoFavorites = async () => {
    context = configurePageTest({
      storage: new FakeStorage({ favoriteIDs: '["fr-75001001","fr-75005002"]' }),
    });
    const rendered = await renderComponent(FavoritesPage);
    context.httpTesting.expectOne(lookupUrl('fr-75001001,fr-75005002')).flush({
      stations: [withoutDistance(totalStation), withoutDistance(carrefourStation)],
      unavailableIdentifiers: [],
      failedIdentifiers: [],
    });
    await context.settle();
    return rendered;
  };

  it('lists the stored favorites without distance', async () => {
    const { element } = await renderWithTwoFavorites();

    expect(stationTitles(element)).toEqual(['TotalEnergies', 'Carrefour Market']);
    expect(textOf(element.querySelector('main'))).not.toContain('km');
  });

  it('credits the French open data of the listed prices', async () => {
    const { element } = await renderWithTwoFavorites();

    expect(
      textOf(element.querySelector('main a[href="https://www.prix-carburants.gouv.fr/"]'))
    ).toBe('Preisdaten: prix-carburants.gouv.fr (öffnet in neuem Tab)');
  });

  it('neither highlights a cheapest favorite nor offers the map action', async () => {
    const { element } = await renderWithTwoFavorites();

    expect(textOf(element.querySelector('main'))).not.toContain('Günstigster Preis');
    expect(() => getButton(element, 'Auf Karte zeigen: TotalEnergies')).toThrow();
  });

  it('removes an unstarred station from the list immediately', async () => {
    const { element } = await renderWithTwoFavorites();

    getButton(element, 'Favorit: TotalEnergies').click();
    await context.settle();

    expect(stationTitles(element)).toEqual(['Carrefour Market']);
    expect(context.storage.getItem('favoriteIDs')).toBe('["fr-75005002"]');

    getButton(element, 'Favorit: Carrefour Market').click();
    await context.settle();

    expect(textOf(element.querySelector('main h2'))).toBe('Keine Favoriten gespeichert');
    expect(context.storage.getItem('favoriteIDs')).toBe('[]');
  });

  it('keeps favorites the API does not know right now and says so', async () => {
    context = configurePageTest({
      storage: new FakeStorage({ favoriteIDs: '["fr-75001001","de-unavailable"]' }),
    });
    const { element } = await renderComponent(FavoritesPage);

    context.httpTesting.expectOne(lookupUrl('fr-75001001,de-unavailable')).flush({
      stations: [withoutDistance(totalStation)],
      unavailableIdentifiers: ['de-unavailable'],
      failedIdentifiers: [],
    });
    await context.settle();

    expect(stationTitles(element)).toEqual(['TotalEnergies']);
    expect(textOf(element.querySelector('main p[role="status"]'))).toBe(
      'Ein Favorit ist gerade nicht verfügbar.'
    );
    expect(context.storage.getItem('favoriteIDs')).toBe('["fr-75001001","de-unavailable"]');
  });

  it('removes unavailable favorites only when the user asks for it', async () => {
    context = configurePageTest({
      storage: new FakeStorage({ favoriteIDs: '["de-first","fr-75001001","de-second"]' }),
    });
    const { element } = await renderComponent(FavoritesPage);

    context.httpTesting.expectOne(lookupUrl('de-first,fr-75001001,de-second')).flush({
      stations: [withoutDistance(totalStation)],
      unavailableIdentifiers: ['de-first', 'de-second'],
      failedIdentifiers: [],
    });
    await context.settle();

    expect(textOf(element.querySelector('main p[role="status"]'))).toBe(
      '2 Favoriten sind gerade nicht verfügbar.'
    );

    getButton(element, 'Nicht verfügbare Favoriten entfernen').click();
    await context.settle();

    expect(context.storage.getItem('favoriteIDs')).toBe('["fr-75001001"]');
    expect(element.querySelector('main p[role="status"]')).toBeNull();
    expect(stationTitles(element)).toEqual(['TotalEnergies']);
    expect(textOf(document.activeElement)).toBe('Gespeicherte Tankstellen');
  });

  it('moves the focus to the empty state when the last favorites are removed', async () => {
    context = configurePageTest({
      storage: new FakeStorage({ favoriteIDs: '["de-first"]' }),
    });
    const { element } = await renderComponent(FavoritesPage);

    context.httpTesting
      .expectOne(lookupUrl('de-first'))
      .flush({ stations: [], unavailableIdentifiers: ['de-first'], failedIdentifiers: [] });
    await context.settle();

    getButton(element, 'Nicht verfügbare Favoriten entfernen').click();
    await context.settle();

    expect(textOf(document.activeElement)).toBe('Keine Favoriten gespeichert');
  });

  it('lists the loaded favorites and reports the ones that failed to load', async () => {
    context = configurePageTest({
      storage: new FakeStorage({ favoriteIDs: '["fr-75001001","fr-75005002"]' }),
    });
    const { element } = await renderComponent(FavoritesPage);

    context.httpTesting.expectOne(lookupUrl('fr-75001001,fr-75005002')).flush({
      stations: [withoutDistance(totalStation)],
      unavailableIdentifiers: [],
      failedIdentifiers: ['fr-75005002'],
    });
    await context.settle();

    expect(stationTitles(element)).toEqual(['TotalEnergies']);
    expect(textOf(element.querySelector('[role="alert"]'))).toBe(
      'Ein Favorit konnte nicht geladen werden. Bitte versuche es später erneut.'
    );
    expect(context.storage.getItem('favoriteIDs')).toBe('["fr-75001001","fr-75005002"]');
  });

  it('reports an unavailable API', async () => {
    context = configurePageTest({ storage: new FakeStorage({ favoriteIDs: '["fr-75001001"]' }) });
    const { element } = await renderComponent(FavoritesPage);

    context.httpTesting.expectOne(lookupUrl('fr-75001001')).flush(BAD_GATEWAY_BODY, BAD_GATEWAY);
    await context.settle();

    expect(textOf(element.querySelector('[role="alert"]'))).toBe(
      'Die Preisdaten sind gerade nicht erreichbar. Bitte versuche es später erneut.'
    );
    expect(context.storage.getItem('favoriteIDs')).toBe('["fr-75001001"]');
  });
});

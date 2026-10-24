import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FakeStorage, storedFavorites } from '../../../testing/fake-storage';
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
  essoStation,
  totalStation,
  withoutDistance,
} from '../../../testing/station-fixtures';
import { stationLookupUrl } from '../../../testing/api-urls';
import { FavoriteStationsResource } from '../../core/favorites/favorite-stations-resource';
import { RECONNECT_DELAY_IN_MILLISECONDS } from '../../core/network/network-status';
import { FavoritesPage } from './favorites-page';

const BAD_GATEWAY = { status: 502, statusText: 'Bad Gateway' };
const BAD_GATEWAY_BODY = { statusCode: 502, message: 'Upstream unavailable' };

describe('FavoritesPage', () => {
  let context: PageTestContext;

  afterEach(() => {
    vi.useRealTimers();
    context.httpTesting.verify();
  });

  it('shows an empty state without favorites and sends no request', async () => {
    context = configurePageTest();

    const { element } = await renderComponent(FavoritesPage);
    await context.settle();

    expect(textOf(element.querySelector('section h2'))).toBe('Favoriten');
    expect(element.querySelector('main, h1')).toBeNull();
    expect(textOf(element.querySelector('section h3'))).toBe('Keine Favoriten gespeichert');
    const exploreLink = [...element.querySelectorAll('a')].find(
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
    context.httpTesting.expectOne(stationLookupUrl('fr-75001001,fr-75005002')).flush({
      stations: [withoutDistance(totalStation), withoutDistance(carrefourStation)],
      unavailableIdentifiers: [],
      failedIdentifiers: [],
    });
    await context.settle();
    return rendered;
  };

  it('explains failed favorites while offline and loads them once the connection is back', async () => {
    vi.useFakeTimers();
    context = configurePageTest({
      storage: new FakeStorage({ favoriteIDs: '["fr-75001001"]' }),
    });
    const { element } = await renderComponent(FavoritesPage);
    window.dispatchEvent(new Event('offline'));
    context.httpTesting
      .expectOne(stationLookupUrl('fr-75001001'))
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await context.settle();

    const offlineNotice = element.querySelector('.favorites__offline');
    expect(offlineNotice?.getAttribute('role')).toBe('status');
    expect(textOf(offlineNotice)).toBe(
      'Du bist offline – Preise werden geladen, sobald du wieder verbunden bist.'
    );
    expect(element.querySelector('[role="alert"]')).toBeNull();

    window.dispatchEvent(new Event('online'));
    await context.settle();
    vi.advanceTimersByTime(RECONNECT_DELAY_IN_MILLISECONDS);
    await context.settle();
    context.httpTesting.expectOne(stationLookupUrl('fr-75001001')).flush({
      stations: [withoutDistance(totalStation)],
      unavailableIdentifiers: [],
      failedIdentifiers: [],
    });
    await context.settle();

    expect(textOf(offlineNotice)).toBe('');
    expect(stationTitles(element)).toEqual(['TotalEnergies']);
  });

  it('lists the stored favorites without distance', async () => {
    const { element } = await renderWithTwoFavorites();

    expect(stationTitles(element)).toEqual(['TotalEnergies', 'Carrefour Market']);
    expect(textOf(element.querySelector('app-station-list'))).not.toContain('km');
  });

  it('credits the French open data of the listed prices', async () => {
    const { element } = await renderWithTwoFavorites();

    expect(textOf(element.querySelector('a[href="https://www.prix-carburants.gouv.fr/"]'))).toBe(
      'Preisdaten: prix-carburants.gouv.fr (öffnet in neuem Tab)'
    );
  });

  it('neither highlights a cheapest favorite nor offers the map action', async () => {
    const { element } = await renderWithTwoFavorites();

    expect(textOf(element)).not.toContain('Günstigster Preis');
    expect(() => getButton(element, 'Auf Karte zeigen: TotalEnergies')).toThrow();
  });

  it('removes an unstarred station from the list immediately', async () => {
    const { element } = await renderWithTwoFavorites();

    getButton(element, 'Favorit: TotalEnergies').click();
    await context.settle();

    expect(stationTitles(element)).toEqual(['Carrefour Market']);
    expect(storedFavorites(context.storage)).toBe('["fr-75005002"]');

    getButton(element, 'Favorit: Carrefour Market').click();
    await context.settle();

    expect(textOf(element.querySelector('h3'))).toBe('Keine Favoriten gespeichert');
    expect(storedFavorites(context.storage)).toBe('[]');
  });

  describe('keeps the focus near an unstarred station, as its row disappears', () => {
    const renderWithThreeFavorites = async () => {
      context = configurePageTest({
        storage: new FakeStorage({ favoriteIDs: '["fr-75001001","fr-75005002","fr-69003001"]' }),
      });
      const rendered = await renderComponent(FavoritesPage);
      context.httpTesting.expectOne(stationLookupUrl('fr-75001001,fr-75005002,fr-69003001')).flush({
        stations: [totalStation, carrefourStation, essoStation].map(withoutDistance),
        unavailableIdentifiers: [],
        failedIdentifiers: [],
      });
      await context.settle();
      return rendered;
    };

    const unstar = async (element: HTMLElement, stationTitle: string) => {
      const star = getButton(element, `Favorit: ${stationTitle}`);
      star.focus();
      star.click();
      await context.settle();
    };

    const focusedName = () =>
      document.activeElement?.getAttribute('aria-label') ?? textOf(document.activeElement);

    afterEach(() => {
      document.body.replaceChildren();
    });

    it('moves to the star of the next station', async () => {
      const { element } = await renderWithThreeFavorites();
      document.body.append(element);

      await unstar(element, 'TotalEnergies');

      expect(focusedName()).toBe('Favorit: Carrefour Market');
    });

    it('moves to the star of the station before the last one', async () => {
      const { element } = await renderWithThreeFavorites();
      document.body.append(element);

      await unstar(element, 'Esso');

      expect(focusedName()).toBe('Favorit: Carrefour Market');
    });

    it('moves to the empty state once the last favorite is unstarred', async () => {
      context = configurePageTest({ storage: new FakeStorage({ favoriteIDs: '["fr-75001001"]' }) });
      const { element } = await renderComponent(FavoritesPage);
      document.body.append(element);
      context.httpTesting.expectOne(stationLookupUrl('fr-75001001')).flush({
        stations: [withoutDistance(totalStation)],
        unavailableIdentifiers: [],
        failedIdentifiers: [],
      });
      await context.settle();

      await unstar(element, 'TotalEnergies');

      expect(focusedName()).toBe('Keine Favoriten gespeichert');
    });

    it('moves to the title when only unavailable favorites are left', async () => {
      context = configurePageTest({
        storage: new FakeStorage({ favoriteIDs: '["fr-75001001","fr-99000001"]' }),
      });
      const { element } = await renderComponent(FavoritesPage);
      document.body.append(element);
      context.httpTesting.expectOne(stationLookupUrl('fr-75001001,fr-99000001')).flush({
        stations: [withoutDistance(totalStation)],
        unavailableIdentifiers: ['fr-99000001'],
        failedIdentifiers: [],
      });
      await context.settle();

      await unstar(element, 'TotalEnergies');

      expect(focusedName()).toBe('Favoriten');
    });
  });

  it('keeps favorites the API does not know right now and says so', async () => {
    context = configurePageTest({
      storage: new FakeStorage({ favoriteIDs: '["fr-75001001","fr-99000001"]' }),
    });
    const { element } = await renderComponent(FavoritesPage);

    context.httpTesting.expectOne(stationLookupUrl('fr-75001001,fr-99000001')).flush({
      stations: [withoutDistance(totalStation)],
      unavailableIdentifiers: ['fr-99000001'],
      failedIdentifiers: [],
    });
    await context.settle();

    expect(stationTitles(element)).toEqual(['TotalEnergies']);
    expect(textOf(element.querySelector('p[role="status"]'))).toBe(
      'Ein Favorit ist gerade nicht verfügbar.'
    );
    expect(storedFavorites(context.storage)).toBe('["fr-75001001","fr-99000001"]');
  });

  it('removes unavailable favorites only when the user asks for it', async () => {
    context = configurePageTest({
      storage: new FakeStorage({ favoriteIDs: '["fr-99000001","fr-75001001","fr-99000002"]' }),
    });
    const { element } = await renderComponent(FavoritesPage);

    context.httpTesting.expectOne(stationLookupUrl('fr-99000001,fr-75001001,fr-99000002')).flush({
      stations: [withoutDistance(totalStation)],
      unavailableIdentifiers: ['fr-99000001', 'fr-99000002'],
      failedIdentifiers: [],
    });
    await context.settle();

    expect(textOf(element.querySelector('p[role="status"]'))).toBe(
      '2 Favoriten sind gerade nicht verfügbar.'
    );

    getButton(element, 'Nicht verfügbare Favoriten entfernen').click();
    await context.settle();

    expect(storedFavorites(context.storage)).toBe('["fr-75001001"]');
    expect(element.querySelector('p[role="status"]')).toBeNull();
    expect(stationTitles(element)).toEqual(['TotalEnergies']);
    expect(textOf(document.activeElement)).toBe('Favoriten');
  });

  it('moves the focus to the empty state when the last favorites are removed', async () => {
    context = configurePageTest({
      storage: new FakeStorage({ favoriteIDs: '["fr-99000001"]' }),
    });
    const { element } = await renderComponent(FavoritesPage);

    context.httpTesting
      .expectOne(stationLookupUrl('fr-99000001'))
      .flush({ stations: [], unavailableIdentifiers: ['fr-99000001'], failedIdentifiers: [] });
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

    context.httpTesting.expectOne(stationLookupUrl('fr-75001001,fr-75005002')).flush({
      stations: [withoutDistance(totalStation)],
      unavailableIdentifiers: [],
      failedIdentifiers: ['fr-75005002'],
    });
    await context.settle();

    expect(stationTitles(element)).toEqual(['TotalEnergies']);
    expect(textOf(element.querySelector('[role="alert"]'))).toBe(
      'Ein Favorit konnte nicht geladen werden. Bitte versuche es später erneut.'
    );
    expect(storedFavorites(context.storage)).toBe('["fr-75001001","fr-75005002"]');
  });

  describe('when fresh prices fail to load', () => {
    const loadedBefore = async (stations: (typeof totalStation)[]) => {
      TestBed.inject(FavoriteStationsResource).stations();
      await context.settle();
      context.httpTesting
        .expectOne(stationLookupUrl(stations.map(station => station.id).join(',')))
        .flush({
          stations: stations.map(withoutDistance),
          unavailableIdentifiers: [],
          failedIdentifiers: [],
        });
      await context.settle();
    };

    it('keeps the prices loaded before and says they may be outdated', async () => {
      context = configurePageTest({ storage: new FakeStorage({ favoriteIDs: '["fr-75001001"]' }) });
      await loadedBefore([totalStation]);

      const { element } = await renderComponent(FavoritesPage);
      await context.settle();
      context.httpTesting
        .expectOne(stationLookupUrl('fr-75001001'))
        .flush(BAD_GATEWAY_BODY, BAD_GATEWAY);
      await context.settle();

      expect(stationTitles(element)).toEqual(['TotalEnergies']);
      expect(textOf(element.querySelector('[role="alert"]'))).toBe(
        'Die Preisdaten sind gerade nicht erreichbar. Bitte versuche es später erneut. Angezeigte Preise sind womöglich nicht mehr aktuell.'
      );
    });

    it('keeps the earlier prices of a favorite that failed and says they may be outdated', async () => {
      context = configurePageTest({
        storage: new FakeStorage({ favoriteIDs: '["fr-75001001","fr-75005002"]' }),
      });
      await loadedBefore([totalStation, carrefourStation]);

      const { element } = await renderComponent(FavoritesPage);
      await context.settle();
      context.httpTesting.expectOne(stationLookupUrl('fr-75001001,fr-75005002')).flush({
        stations: [withoutDistance(totalStation)],
        unavailableIdentifiers: [],
        failedIdentifiers: ['fr-75005002'],
      });
      await context.settle();

      expect(stationTitles(element)).toEqual(['TotalEnergies', 'Carrefour Market']);
      expect(textOf(element.querySelector('[role="alert"]'))).toBe(
        'Ein Favorit konnte nicht geladen werden. Bitte versuche es später erneut. Angezeigte Preise sind womöglich nicht mehr aktuell.'
      );
    });
  });

  it('reports an unavailable API', async () => {
    context = configurePageTest({ storage: new FakeStorage({ favoriteIDs: '["fr-75001001"]' }) });
    const { element } = await renderComponent(FavoritesPage);

    context.httpTesting
      .expectOne(stationLookupUrl('fr-75001001'))
      .flush(BAD_GATEWAY_BODY, BAD_GATEWAY);
    await context.settle();

    expect(textOf(element.querySelector('[role="alert"]'))).toBe(
      'Die Preisdaten sind gerade nicht erreichbar. Bitte versuche es später erneut.'
    );
    expect(storedFavorites(context.storage)).toBe('["fr-75001001"]');
  });

  describe('closing', () => {
    const renderOpened = async (urls: string[]) => {
      context = configurePageTest({
        routes: [
          { path: '', children: [] },
          { path: 'favorites', children: [] },
        ],
        providers: [provideLocationMocks()],
      });
      for (const url of urls) {
        await TestBed.inject(Router).navigateByUrl(url);
      }
      const rendered = await renderComponent(FavoritesPage);
      await rendered.fixture.whenStable();
      return { ...rendered, location: TestBed.inject(Location) };
    };

    it('starts at its title', async () => {
      await renderOpened(['/favorites']);

      expect(textOf(document.activeElement)).toBe('Favoriten');
    });

    it('goes back to the list it was opened from, with the back button', async () => {
      const { element, location } = await renderOpened(['/', '/favorites']);

      getButton(element, 'Zurück').click();

      expect(location.path() || '/').toBe('/');
      location.forward();
      expect(location.path()).toBe('/favorites');
    });

    it('goes back to the list with Escape', async () => {
      const { element, location } = await renderOpened(['/', '/favorites']);

      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(location.path() || '/').toBe('/');
    });

    const exploreLinkOf = (element: HTMLElement): HTMLAnchorElement => {
      const exploreLink = [...element.querySelectorAll('a')].find(
        link => textOf(link) === 'Tankstellen erkunden'
      );
      if (exploreLink === undefined) {
        throw new Error('The empty state has no link „Tankstellen erkunden“.');
      }
      return exploreLink;
    };

    it('closes the favorites with the link of the empty state instead of opening the list anew', async () => {
      const { element, location } = await renderOpened(['/', '/favorites']);

      exploreLinkOf(element).click();

      expect(location.path() || '/').toBe('/');
      location.forward();
      expect(location.path()).toBe('/favorites');
    });

    it('leaves a click with a modifier key to the browser, e.g. for a new tab', async () => {
      const { element, location } = await renderOpened(['/', '/favorites']);
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });

      exploreLinkOf(element).dispatchEvent(click);

      expect(click.defaultPrevented).toBe(false);
      expect(location.path()).toBe('/favorites');
    });

    it('replaces a deep link with the list, so Back does not open the favorites again', async () => {
      const { fixture, element, location } = await renderOpened(['/favorites']);

      getButton(element, 'Zurück').click();
      await fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/');
      location.back();
      expect(location.path()).not.toBe('/favorites');
    });
  });

  it('refreshes the prices already loaded elsewhere when it opens', async () => {
    context = configurePageTest({ storage: new FakeStorage({ favoriteIDs: '["fr-75001001"]' }) });
    const favoriteStations = TestBed.inject(FavoriteStationsResource);
    await context.settle();
    context.httpTesting.expectOne(stationLookupUrl('fr-75001001')).flush({
      stations: [withoutDistance(totalStation)],
      unavailableIdentifiers: [],
      failedIdentifiers: [],
    });
    await context.settle();
    expect(favoriteStations.stations()).toHaveLength(1);

    const { element } = await renderComponent(FavoritesPage);
    await context.settle();

    expect(stationTitles(element)).toEqual(['TotalEnergies']);
    context.httpTesting.expectOne(stationLookupUrl('fr-75001001')).flush({
      stations: [withoutDistance(totalStation)],
      unavailableIdentifiers: [],
      failedIdentifiers: [],
    });
  });
});

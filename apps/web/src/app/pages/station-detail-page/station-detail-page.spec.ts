import { MILLISECONDS_PER_MINUTE } from '@genialtanken/contracts';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { Station } from '@genialtanken/contracts';
import { OpenedStationStore } from '../../core/stations/opened-station-store';
import { NearbyStationsStore } from '../../core/stations/nearby-stations-store';
import {
  accessibleTextOf,
  configurePageTest,
  getButton,
  hostElementOf,
  textOf,
} from '../../../testing/render-page';
import type { PageTestContext } from '../../../testing/render-page';
import { essoStation, totalStation, withoutDistance } from '../../../testing/station-fixtures';
import { StationDetailPage } from './station-detail-page';
import { STATIONS_URL, stationLookupUrl, stationUrl } from '../../../testing/api-urls';
import { FakeStorage, storedFavorites } from '../../../testing/fake-storage';
import { FAVORITES_STORAGE_KEY } from '../../core/favorites/local-storage-favorites-repository';
import { SETTINGS_STORAGE_KEY } from '../../core/settings/settings-store';
import { Logger } from '../../core/logging/logger';
import { FavoriteStationsResource } from '../../core/favorites/favorite-stations-resource';
import { SHARE } from '../../core/sharing/share';
import type { Share } from '../../core/sharing/share';

@Component({ template: '' })
class EmptyPage {}

describe('StationDetailPage', () => {
  let context: PageTestContext;

  /** The explore page around the card has searched already, as when a list row opens it. */
  const loadNearbyStations = async (stations: Station[]) => {
    TestBed.inject(NearbyStationsStore).stations();
    await context.settle();
    context.httpTesting.expectOne(request => request.url === STATIONS_URL).flush(stations);
    await context.settle();
  };

  const renderStation = async (stationIdentifier: string, nearbyStations: Station[] = []) => {
    await loadNearbyStations(nearbyStations);
    const fixture = TestBed.createComponent(StationDetailPage);
    document.body.append(hostElementOf(fixture));
    fixture.componentRef.setInput('id', stationIdentifier);
    await context.settle();
    return { fixture, element: hostElementOf(fixture) };
  };

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(160);
    context = configurePageTest({ routes: [{ path: '', component: EmptyPage }] });
  });

  afterEach(() => {
    context.httpTesting.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('shows brand, name, address, open status, opening times and all prices', async () => {
    const { element } = await renderStation(essoStation.id);

    context.httpTesting.expectOne(stationUrl('fr-69003001')).flush(withoutDistance(essoStation));
    await context.settle();

    const article = element.querySelector('article');
    expect(textOf(article?.querySelector('h2'))).toBe('Esso');
    expect(textOf(article?.querySelector('address'))).toBe('Boulevard Vivier-Merle 19 69003 Lyon');
    expect(article?.textContent).toContain('Relais Esso Part-Dieu');
    expect(article?.textContent).toContain('Die Tankstelle hat leider geschlossen.');
    expect(
      [...(article?.querySelectorAll('.opening-times li') ?? [])].map(day => textOf(day))
    ).toEqual([
      'Montag: 06:00 - 22:00',
      'Dienstag: 06:00 - 22:00',
      'Mittwoch: 06:00 - 22:00',
      'Donnerstag: 06:00 - 22:00',
      'Freitag: 06:00 - 22:00',
      'Samstag: 07:00 - 12:00, 14:00 - 20:00',
      'Sonntag: keine Angabe',
      'Feiertag: 08:00 - 12:00',
    ]);
  });

  it('moves the marked day along when midnight passes', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-10T23:59:30') });
    const { element } = await renderStation(totalStation.id);
    context.httpTesting.expectOne(stationUrl('fr-75001001')).flush(withoutDistance(totalStation));
    await context.settle();
    const today = () => textOf(element.querySelector('.opening-times [aria-current="date"]'));

    expect(today()).toBe('Samstag: 07:00 - 12:00, 14:00 - 20:00');

    vi.advanceTimersByTime(MILLISECONDS_PER_MINUTE);
    await context.settle();

    expect(today()).toBe('Sonntag: keine Angabe');
  });

  it('leads the price board with the stored fuel and names missing prices', async () => {
    context.storage.setItem(SETTINGS_STORAGE_KEY, '{"fuelType":"lpg","radiusInKilometers":5}');
    const { element } = await renderStation(totalStation.id);

    context.httpTesting.expectOne(stationUrl('fr-75001001')).flush(withoutDistance(totalStation));
    await context.settle();

    const priceTexts = [...element.querySelectorAll('.price-board li')].map(price =>
      accessibleTextOf(price)
    );
    expect(priceTexts).toEqual([
      'LPG Dein Kraftstoff kein Preis',
      'Super E5 1,859 €',
      'Super E10 1,799 €',
      'Super Plus 1,929 €',
      'Diesel 1,689 €',
      'E85 kein Preis',
    ]);
  });

  it('hides the open status when the data source has none', async () => {
    const { element } = await renderStation(totalStation.id);

    context.httpTesting.expectOne(stationUrl('fr-75001001')).flush(withoutDistance(totalStation));
    await context.settle();

    expect(element.textContent).not.toContain('Die Tankstelle ist geöffnet.');
    expect(element.textContent).not.toContain('Die Tankstelle hat leider geschlossen.');
    expect(textOf(element.querySelector('article h2'))).toBe('TotalEnergies');
  });

  it('credits the French open data for a French station', async () => {
    const { element } = await renderStation(totalStation.id);
    context.httpTesting.expectOne(stationUrl('fr-75001001')).flush(withoutDistance(totalStation));
    await context.settle();

    expect(textOf(element.querySelector('a[href="https://www.prix-carburants.gouv.fr/"]'))).toBe(
      'Preisdaten: prix-carburants.gouv.fr (öffnet in neuem Tab)'
    );
  });

  it('stars the station', async () => {
    const { element } = await renderStation(totalStation.id);
    context.httpTesting.expectOne(stationUrl('fr-75001001')).flush(withoutDistance(totalStation));
    await context.settle();

    getButton(element, 'Favorit: TotalEnergies').click();
    await context.settle();

    expect(storedFavorites(context.storage)).toBe('["fr-75001001"]');
    context.httpTesting.expectOne(stationLookupUrl('fr-75001001'));
  });

  describe('for a station the app already loaded', () => {
    it('shows a station of the search results at once, without asking the API again', async () => {
      const { element } = await renderStation(totalStation.id, [totalStation, essoStation]);

      context.httpTesting.expectNone(stationUrl('fr-75001001'));
      expect(element.textContent).not.toContain('wird geladen');
      expect(textOf(element.querySelector('article h2'))).toBe('TotalEnergies');
      expect(element.querySelector('.price-board')?.textContent).toContain('1,859 €');
      expect(getButton(element, 'Favorit: TotalEnergies')).toBeDefined();
      expect(textOf(document.activeElement)).toBe('TotalEnergies');
    });

    it('shows a loaded favorite at once', async () => {
      TestBed.resetTestingModule();
      context = configurePageTest({
        storage: new FakeStorage({ [FAVORITES_STORAGE_KEY]: '["fr-69003001"]' }),
        routes: [{ path: '', component: EmptyPage }],
      });
      TestBed.inject(FavoriteStationsResource).stations();
      await context.settle();
      context.httpTesting.expectOne(stationLookupUrl('fr-69003001')).flush({
        stations: [withoutDistance(essoStation)],
        unavailableIdentifiers: [],
        failedIdentifiers: [],
      });

      const { element } = await renderStation(essoStation.id);

      context.httpTesting.expectNone(stationUrl('fr-69003001'));
      expect(textOf(element.querySelector('article h2'))).toBe('Esso');
    });
  });

  describe('opened through a link without loaded data', () => {
    it('offers to try again after a failure and shows the station once it loads', async () => {
      const { element } = await renderStation(totalStation.id);

      context.httpTesting
        .expectOne(stationUrl('fr-75001001'))
        .flush(
          { statusCode: 502, message: 'Bad Gateway' },
          { status: 502, statusText: 'Bad Gateway' }
        );
      await context.settle();

      expect(textOf(element.querySelector('[role="alert"]'))).toContain(
        'Die Preisdaten sind gerade nicht erreichbar.'
      );
      expect(getButton(element, 'Schließen')).toBeDefined();

      getButton(element, 'Erneut versuchen').click();
      await context.settle();
      context.httpTesting.expectOne(stationUrl('fr-75001001')).flush(withoutDistance(totalStation));
      await context.settle();

      expect(textOf(element.querySelector('article h2'))).toBe('TotalEnergies');
      expect(element.querySelector('[role="alert"]')).toBeNull();
    });
  });

  it('explains an unknown station', async () => {
    const { element } = await renderStation('fr-unknown');

    context.httpTesting
      .expectOne(stationUrl('fr-unknown'))
      .flush(
        { statusCode: 404, message: 'Station not found' },
        { status: 404, statusText: 'Not Found' }
      );
    await context.settle();

    expect(textOf(element.querySelector('[role="alert"]'))).toBe(
      'Die Tankstelle konnte in unserer Datenbank nicht gefunden werden.'
    );
    expect(element.querySelector('article')).toBeNull();
  });

  it('starts at the station name once it is shown', async () => {
    await renderStation(totalStation.id);
    context.httpTesting.expectOne(stationUrl('fr-75001001')).flush(withoutDistance(totalStation));
    await context.settle();

    expect(textOf(document.activeElement)).toBe('TotalEnergies');
  });

  it('shares the loaded station while it is open', async () => {
    const { fixture } = await renderStation(totalStation.id);
    const openedStation = TestBed.inject(OpenedStationStore);
    context.httpTesting.expectOne(stationUrl('fr-75001001')).flush(withoutDistance(totalStation));
    await context.settle();

    expect(openedStation.station()?.id).toBe('fr-75001001');

    fixture.destroy();
    expect(openedStation.station()).toBeUndefined();
  });

  it('returns to the list with the close button and with Escape', async () => {
    const { element } = await renderStation(totalStation.id);
    context.httpTesting.expectOne(stationUrl('fr-75001001')).flush(withoutDistance(totalStation));
    await context.settle();
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    getButton(element, 'Schließen').click();
    element
      .querySelector('section')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(navigateByUrl.mock.calls).toEqual([['/'], ['/']]);
  });

  it('can be closed while it is still loading', async () => {
    const { element } = await renderStation(totalStation.id);

    expect(getButton(element, 'Schließen')).toBeDefined();
    context.httpTesting.expectOne(stationUrl('fr-75001001'));
  });

  describe('sharing', () => {
    const renderLoadedStation = async (share: Share | undefined) => {
      TestBed.resetTestingModule();
      context = configurePageTest({
        routes: [{ path: '', component: EmptyPage }],
        providers: [{ provide: SHARE, useValue: share }],
      });
      const logged = vi.spyOn(TestBed.inject(Logger), 'error').mockImplementation(() => undefined);
      const { element } = await renderStation(totalStation.id);
      context.httpTesting.expectOne(stationUrl('fr-75001001')).flush(withoutDistance(totalStation));
      await context.settle();
      return { element, logged };
    };

    const shareButtonOf = (element: HTMLElement): HTMLButtonElement | undefined =>
      [...element.querySelectorAll('button')].find(button => textOf(button) === 'Teilen');

    it('offers no share button without a share sheet', async () => {
      const { element } = await renderLoadedStation(undefined);

      expect(shareButtonOf(element)).toBeUndefined();
    });

    it('shares name, address and the link of the card', async () => {
      const share = vi.fn<Share>().mockResolvedValue(undefined);
      const { element, logged } = await renderLoadedStation(share);

      shareButtonOf(element)?.click();
      await context.settle();

      expect(share).toHaveBeenCalledOnce();
      const [data] = share.mock.calls[0] ?? [];
      expect(data?.title).toBe('TotalEnergies');
      expect(data?.text).toBe('12 Rue de Rivoli, 75001 Paris');
      expect(new URL(data?.url ?? '').pathname).toBe('/stations/fr-75001001');
      expect(logged).not.toHaveBeenCalled();
    });

    it('ignores a closed share sheet', async () => {
      const share = vi
        .fn<Share>()
        .mockRejectedValue(new DOMException('Share canceled', 'AbortError'));
      const { element, logged } = await renderLoadedStation(share);

      shareButtonOf(element)?.click();
      await context.settle();

      expect(share).toHaveBeenCalledOnce();
      expect(logged).not.toHaveBeenCalled();
    });

    it('logs any other failure', async () => {
      const failure = new DOMException('Not allowed', 'NotAllowedError');
      const share = vi.fn<Share>().mockRejectedValue(failure);
      const { element, logged } = await renderLoadedStation(share);

      shareButtonOf(element)?.click();
      await context.settle();

      expect(logged).toHaveBeenCalledExactlyOnceWith('Sharing the station failed.', failure);
    });
  });
});

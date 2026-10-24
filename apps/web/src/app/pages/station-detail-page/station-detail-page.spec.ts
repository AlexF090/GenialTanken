import { MILLISECONDS_PER_MINUTE } from '@genialtanken/contracts';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component, signal } from '@angular/core';
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
import {
  carrefourStation,
  essoStation,
  totalStation,
  withoutDistance,
  withPrices,
} from '../../../testing/station-fixtures';
import { KNOWN_STATION_SOURCES } from '../../core/stations/known-stations';
import { RECONNECT_DELAY_IN_MILLISECONDS } from '../../core/network/network-status';
import { COLD_START_HINT_DELAY_IN_MILLISECONDS } from '../../core/api-wake-up/cold-start-hint';
import { StationDetailPage } from './station-detail-page';
import { STATIONS_URL, stationLookupUrl, stationUrl } from '../../../testing/api-urls';
import { FakeStorage, storedFavorites } from '../../../testing/fake-storage';
import { FAVORITES_STORAGE_KEY } from '../../core/favorites/local-storage-favorites-repository';
import { SETTINGS_STORAGE_KEY, SettingsStore } from '../../core/settings/settings-store';
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
    // First, so a failing verify does not leave fake timers to the next tests.
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.replaceChildren();
    context.httpTesting.verify();
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
    const priceBoardOf = (element: HTMLElement) =>
      element.querySelector('.price-board')?.textContent ?? '';

    it('shows a station of the search results at once, without asking the API again', async () => {
      const { element } = await renderStation(totalStation.id, [totalStation, essoStation]);

      context.httpTesting.verify();
      expect(element.textContent).not.toContain('wird geladen');
      expect(textOf(element.querySelector('article h2'))).toBe('TotalEnergies');
      expect(priceBoardOf(element)).toContain('1,859 €');
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

      context.httpTesting.verify();
      expect(textOf(element.querySelector('article h2'))).toBe('Esso');
    });

    it('shows the station of the card that was open at once', async () => {
      TestBed.inject(OpenedStationStore).open(withoutDistance(carrefourStation), undefined);

      const { element } = await renderStation(carrefourStation.id);

      context.httpTesting.verify();
      expect(textOf(element.querySelector('article h2'))).toBe('Carrefour Market');
    });

    it('follows the search results when they refresh', async () => {
      const { element } = await renderStation(totalStation.id, [totalStation]);

      TestBed.inject(NearbyStationsStore).refresh();
      await context.settle();
      context.httpTesting
        .expectOne(request => request.url === STATIONS_URL)
        .flush([withPrices(totalStation, { e5: 1.749 })]);
      await context.settle();

      expect(priceBoardOf(element)).toContain('1,749 €');
      expect(priceBoardOf(element)).not.toContain('1,859 €');
    });

    it('stays without loading when a new search leaves the station out', async () => {
      const { element } = await renderStation(totalStation.id, [totalStation]);

      TestBed.inject(SettingsStore).update({ radiusInKilometers: 2 });
      await context.settle();
      context.httpTesting.expectOne(request => request.url === STATIONS_URL).flush([essoStation]);
      await context.settle();

      context.httpTesting.verify();
      expect(element.textContent).not.toContain('wird geladen');
      expect(textOf(element.querySelector('article h2'))).toBe('TotalEnergies');
      expect(TestBed.inject(OpenedStationStore).station()?.id).toBe(totalStation.id);
    });

    describe('from search results of the running app', () => {
      const SEARCHED_AT = new Date('2026-10-23T12:00:00');

      const renderAfterMinutes = async (minutes: number) => {
        vi.useFakeTimers({ now: SEARCHED_AT });
        await loadNearbyStations([totalStation]);
        vi.advanceTimersByTime(minutes * MILLISECONDS_PER_MINUTE);
        const fixture = TestBed.createComponent(StationDetailPage);
        document.body.append(hostElementOf(fixture));
        fixture.componentRef.setInput('id', totalStation.id);
        await context.settle();
        return hostElementOf(fixture);
      };

      it('asks the API for nothing within five minutes of the search', async () => {
        const element = await renderAfterMinutes(4);

        context.httpTesting.verify();
        expect(priceBoardOf(element)).toContain('1,859 €');
        expect(TestBed.inject(OpenedStationStore).loadedAt()).toEqual(SEARCHED_AT);
      });

      it('refreshes the prices in the background once the search is older', async () => {
        const element = await renderAfterMinutes(6);

        expect(element.textContent).not.toContain('wird geladen');
        expect(priceBoardOf(element)).toContain('1,859 €');

        context.httpTesting
          .expectOne(stationUrl(totalStation.id))
          .flush(withoutDistance(withPrices(totalStation, { e5: 1.749 })));
        await context.settle();

        expect(priceBoardOf(element)).toContain('1,749 €');
        expect(TestBed.inject(OpenedStationStore).loadedAt()).toEqual(
          new Date(SEARCHED_AT.getTime() + 6 * MILLISECONDS_PER_MINUTE)
        );
      });
    });

    describe('with a known load time', () => {
      const NOW = new Date('2026-10-23T12:00:00');
      const knownResults = signal<readonly Station[]>([totalStation]);
      const loadedAt = signal<Date | undefined>(undefined);

      const renderKnownStation = async (minutesAgo: number) => {
        vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
        loadedAt.set(new Date(NOW.getTime() - minutesAgo * MILLISECONDS_PER_MINUTE));
        TestBed.resetTestingModule();
        context = configurePageTest({
          routes: [{ path: '', component: EmptyPage }],
          providers: [
            {
              provide: KNOWN_STATION_SOURCES,
              useValue: [{ stations: knownResults, loadedAt }],
            },
          ],
        });
        const fixture = TestBed.createComponent(StationDetailPage);
        document.body.append(hostElementOf(fixture));
        fixture.componentRef.setInput('id', totalStation.id);
        await context.settle();
        return hostElementOf(fixture);
      };

      it('asks the API for nothing while the prices are current', async () => {
        const element = await renderKnownStation(4);

        context.httpTesting.verify();
        expect(priceBoardOf(element)).toContain('1,859 €');
      });

      it('shows outdated prices at once and replaces them with fresh ones', async () => {
        const element = await renderKnownStation(60);

        expect(element.textContent).not.toContain('wird geladen');
        expect(priceBoardOf(element)).toContain('1,859 €');

        context.httpTesting
          .expectOne(stationUrl(totalStation.id))
          .flush(withoutDistance(withPrices(totalStation, { e5: 1.749 })));
        await context.settle();

        expect(priceBoardOf(element)).toContain('1,749 €');
      });

      it('keeps the outdated prices when the refresh fails', async () => {
        const element = await renderKnownStation(60);

        context.httpTesting
          .expectOne(stationUrl(totalStation.id))
          .flush(
            { statusCode: 502, message: 'Bad Gateway' },
            { status: 502, statusText: 'Bad Gateway' }
          );
        await context.settle();

        expect(priceBoardOf(element)).toContain('1,859 €');
        expect(element.querySelector('[role="alert"]')).toBeNull();
      });
    });
  });

  describe('moving on to another station', () => {
    it('no longer counts the previous station as opened while the next one loads', async () => {
      const { fixture, element } = await renderStation(totalStation.id, [totalStation]);
      const openedStation = TestBed.inject(OpenedStationStore);

      fixture.componentRef.setInput('id', essoStation.id);
      await context.settle();

      expect(openedStation.station()).toBeUndefined();
      expect(element.querySelector('article')).toBeNull();

      context.httpTesting.expectOne(stationUrl(essoStation.id)).flush(withoutDistance(essoStation));
      await context.settle();

      expect(openedStation.station()?.id).toBe(essoStation.id);
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

  it('loads a station that failed offline once the connection is back', async () => {
    vi.useFakeTimers();
    const { element } = await renderStation(totalStation.id);
    window.dispatchEvent(new Event('offline'));
    context.httpTesting
      .expectOne(stationUrl('fr-75001001'))
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await context.settle();

    window.dispatchEvent(new Event('online'));
    await context.settle();
    vi.advanceTimersByTime(RECONNECT_DELAY_IN_MILLISECONDS);
    await context.settle();
    context.httpTesting.expectOne(stationUrl('fr-75001001')).flush(withoutDistance(totalStation));
    // The search results around the card reload as well.
    context.httpTesting.expectOne(request => request.url === STATIONS_URL).flush([]);
    await context.settle();

    expect(textOf(element.querySelector('article h2'))).toBe('TotalEnergies');
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

  describe('closing', () => {
    const renderOpenedCard = async (urls: string[]) => {
      TestBed.resetTestingModule();
      context = configurePageTest({
        routes: [
          { path: '', component: EmptyPage },
          { path: 'stations/:id', component: EmptyPage },
        ],
        providers: [provideLocationMocks()],
      });
      for (const url of urls) {
        await TestBed.inject(Router).navigateByUrl(url);
      }
      const rendered = await renderStation(totalStation.id, [totalStation]);
      return { ...rendered, location: TestBed.inject(Location) };
    };

    it('goes back to the list it was opened from, with the close button', async () => {
      const { element, location } = await renderOpenedCard(['/', '/stations/fr-75001001']);

      getButton(element, 'Schließen').click();

      expect(location.path() || '/').toBe('/');
      location.forward();
      expect(location.path()).toBe('/stations/fr-75001001');
    });

    it('goes back to the list with Escape', async () => {
      const { element, location } = await renderOpenedCard(['/', '/stations/fr-75001001']);

      element
        .querySelector('section')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(location.path() || '/').toBe('/');
    });

    it('replaces a shared link with the list, so Back does not open the card again', async () => {
      const { element, location } = await renderOpenedCard(['/stations/fr-75001001']);

      getButton(element, 'Schließen').click();
      await context.settle();

      expect(TestBed.inject(Router).url).toBe('/');
      location.back();
      expect(location.path()).not.toBe('/stations/fr-75001001');
    });
  });

  it('can be closed while it is still loading', async () => {
    const { element } = await renderStation(totalStation.id);

    expect(getButton(element, 'Schließen')).toBeDefined();
    context.httpTesting.expectOne(stationUrl('fr-75001001'));
  });

  describe('while an unknown station loads', () => {
    const skeletonOf = (element: HTMLElement) => element.querySelector('.station-card__skeleton');

    it('draws a quiet outline of the card and announces the loading as text', async () => {
      const { element } = await renderStation(totalStation.id);
      context.httpTesting.expectOne(stationUrl('fr-75001001'));

      expect(textOf(element.querySelector('[role="status"]'))).toBe('Tankstelle wird geladen …');
      const hiddenBlockOf = (selector: string) =>
        element.querySelector(`[aria-hidden="true"] ${selector}`);
      expect(skeletonOf(element)?.getAttribute('aria-hidden')).toBe('true');
      expect(hiddenBlockOf('.station-card__skeleton-title.skeleton-block')).not.toBeNull();
      expect(hiddenBlockOf('.station-card__skeleton-subtitle.skeleton-block')).not.toBeNull();
      expect(hiddenBlockOf('.station-card__skeleton-section-title.skeleton-block')).not.toBeNull();
      expect(hiddenBlockOf('app-skeleton-rows[variant="price"]')).not.toBeNull();
      expect(element.querySelector('article')).toBeNull();
    });

    it('draws the action tiles Route and Favorit, without a share sheet no Teilen', async () => {
      const { element } = await renderStation(totalStation.id);
      context.httpTesting.expectOne(stationUrl('fr-75001001'));

      expect(element.querySelectorAll('.station-card__skeleton-tile.skeleton-block')).toHaveLength(
        2
      );
    });

    it('draws a third action tile for Teilen when the browser can share', async () => {
      TestBed.resetTestingModule();
      context = configurePageTest({
        routes: [{ path: '', component: EmptyPage }],
        providers: [{ provide: SHARE, useValue: () => Promise.resolve() }],
      });
      const { element } = await renderStation(totalStation.id);
      context.httpTesting.expectOne(stationUrl('fr-75001001'));

      expect(element.querySelectorAll('.station-card__skeleton-tile.skeleton-block')).toHaveLength(
        3
      );
    });

    it('renders the status region empty first, so screen readers announce the loading', async () => {
      await loadNearbyStations([]);
      const fixture = TestBed.createComponent(StationDetailPage);
      const element = hostElementOf(fixture);
      document.body.append(element);
      fixture.componentRef.setInput('id', totalStation.id);
      TestBed.tick();

      const status = element.querySelector('.station-card > [role="status"]');
      expect(status).not.toBeNull();
      expect(skeletonOf(element)).not.toBeNull();
      expect(textOf(status)).toBe('');

      await context.settle();
      expect(element.querySelector('.station-card > [role="status"]')).toBe(status);
      expect(textOf(status)).toBe('Tankstelle wird geladen …');
      context.httpTesting.expectOne(stationUrl('fr-75001001'));
    });

    it('mentions the waking server below the outline after a few seconds', async () => {
      vi.useFakeTimers();
      const { element } = await renderStation(totalStation.id);
      const request = context.httpTesting.expectOne(stationUrl('fr-75001001'));
      const coldStartHint =
        'Der Server wird gerade gestartet. Das kann beim ersten Aufruf bis zu einer Minute dauern.';
      const visibleHintOf = () => element.querySelector('.station-card__cold-start-hint');

      vi.advanceTimersByTime(COLD_START_HINT_DELAY_IN_MILLISECONDS - 1);
      await context.settle();
      expect(visibleHintOf()).toBeNull();

      vi.advanceTimersByTime(1);
      await context.settle();
      expect(textOf(element.querySelector('[role="status"]'))).toBe(
        `Tankstelle wird geladen … ${coldStartHint}`
      );
      expect(textOf(visibleHintOf())).toBe(coldStartHint);
      // The status region says it already; screen readers would hear it twice.
      expect(visibleHintOf()?.closest('[aria-hidden="true"]')).not.toBeNull();

      request.flush(withoutDistance(totalStation));
      await context.settle();
      expect(visibleHintOf()).toBeNull();
      expect(element.textContent).not.toContain(coldStartHint);
    });

    it('replaces the outline with the error and keeps the status region empty', async () => {
      const { element } = await renderStation(totalStation.id);

      context.httpTesting
        .expectOne(stationUrl('fr-75001001'))
        .flush(
          { statusCode: 502, message: 'Bad Gateway' },
          { status: 502, statusText: 'Bad Gateway' }
        );
      await context.settle();

      expect(skeletonOf(element)).toBeNull();
      expect(textOf(element.querySelector('[role="status"]'))).toBe('');
      expect(getButton(element, 'Erneut versuchen')).toBeDefined();
    });
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

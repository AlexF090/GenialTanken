import { MILLISECONDS_PER_MINUTE } from '@genialtanken/contracts';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { OpenedStationStore } from '../../core/stations/opened-station-store';
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
import { stationUrl } from '../../../testing/api-urls';
import { storedFavorites } from '../../../testing/fake-storage';
import { SETTINGS_STORAGE_KEY } from '../../core/settings/settings-store';

@Component({ template: '' })
class EmptyPage {}

describe('StationDetailPage', () => {
  let context: PageTestContext;

  const renderStation = async (stationIdentifier: string) => {
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
});

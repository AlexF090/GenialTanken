import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  accessibleTextOf,
  configurePageTest,
  getButton,
  textOf,
} from '../../../testing/render-page';
import type { PageTestContext } from '../../../testing/render-page';
import { aralStation, totalStation, withoutDistance } from '../../../testing/station-fixtures';
import { StationDetailPage } from './station-detail-page';

@Component({ template: '' })
class EmptyPage {}

const backLinkOf = (element: Element): string | null | undefined =>
  [...element.querySelectorAll('header a')]
    .find(link => accessibleTextOf(link) === 'Zurück')
    ?.getAttribute('href');

describe('StationDetailPage back link', () => {
  let context: PageTestContext;

  beforeEach(() => {
    context = configurePageTest({
      routes: [
        { path: '', component: EmptyPage },
        { path: 'favorites', component: EmptyPage },
        { path: 'settings', component: EmptyPage },
        { path: 'stations/:id', component: StationDetailPage },
      ],
    });
  });

  afterEach(() => {
    context.httpTesting.match(() => true);
  });

  const openStationAfter = async (previousUrl: string | undefined): Promise<Element> => {
    const harness = await RouterTestingHarness.create();
    if (previousUrl !== undefined) {
      await harness.navigateByUrl(previousUrl);
    }
    await harness.navigateByUrl(`/stations/${totalStation.id}`);
    return harness.routeNativeElement ?? document.createElement('div');
  };

  it('returns to the favorites when the station was opened there', async () => {
    expect(backLinkOf(await openStationAfter('/favorites'))).toBe('/favorites');
  });

  it('returns to the start page when the station was opened from it', async () => {
    expect(backLinkOf(await openStationAfter('/'))).toBe('/');
  });

  it('returns to the start page when the station was opened from another page', async () => {
    expect(backLinkOf(await openStationAfter('/settings'))).toBe('/');
  });

  it('returns to the start page when the station was opened directly', async () => {
    expect(backLinkOf(await openStationAfter(undefined))).toBe('/');
  });
});

describe('StationDetailPage', () => {
  let context: PageTestContext;

  const renderStation = async (stationId: string) => {
    const fixture = TestBed.createComponent(StationDetailPage);
    fixture.componentRef.setInput('id', stationId);
    await context.settle();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  };

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(160);
    context = configurePageTest();
  });

  afterEach(() => {
    context.httpTesting.verify();
    vi.restoreAllMocks();
  });

  it('shows brand, name, address, open status, opening times and all prices', async () => {
    const { element } = await renderStation(aralStation.id);

    context.httpTesting
      .expectOne('/api/stations/de-11111111-1111-4111-8111-111111111111')
      .flush(withoutDistance(aralStation));
    await context.settle();

    const article = element.querySelector('article');
    expect(textOf(element.querySelector('header h1'))).toBe('Details');
    expect(textOf(article?.querySelector('h2'))).toBe('Aral');
    expect(textOf(article?.querySelector('address'))).toBe('Wilhelmshöher Allee 100 34119 Kassel');
    expect(article?.textContent).toContain('Aral Tankstelle Kassel');
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
    expect(element.querySelector('.leaflet-container')).not.toBeNull();
  });

  it('leads the price board with the stored fuel and names missing prices', async () => {
    context.storage.setItem('genialtanken.settings', '{"fuelType":"lpg","radiusInKilometers":5}');
    const { element } = await renderStation(totalStation.id);

    context.httpTesting.expectOne('/api/stations/fr-75001001').flush(withoutDistance(totalStation));
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

    context.httpTesting.expectOne('/api/stations/fr-75001001').flush(withoutDistance(totalStation));
    await context.settle();

    expect(element.textContent).not.toContain('Die Tankstelle ist geöffnet.');
    expect(element.textContent).not.toContain('Die Tankstelle hat leider geschlossen.');
    expect(textOf(element.querySelector('article h2'))).toBe('TotalEnergies');
  });

  it('credits the French open data for a French station', async () => {
    const { element } = await renderStation(totalStation.id);
    context.httpTesting.expectOne('/api/stations/fr-75001001').flush(withoutDistance(totalStation));
    await context.settle();

    expect(
      textOf(element.querySelector('main a[href="https://www.prix-carburants.gouv.fr/"]'))
    ).toBe('Preisdaten: prix-carburants.gouv.fr (öffnet in neuem Tab)');
  });

  it('does not credit the French open data for a German station', async () => {
    const { element } = await renderStation(aralStation.id);
    context.httpTesting
      .expectOne('/api/stations/de-11111111-1111-4111-8111-111111111111')
      .flush(withoutDistance(aralStation));
    await context.settle();

    expect(element.querySelector('app-data-source-credit')).toBeNull();
  });

  it('stars the station', async () => {
    const { element } = await renderStation(totalStation.id);
    context.httpTesting.expectOne('/api/stations/fr-75001001').flush(withoutDistance(totalStation));
    await context.settle();

    getButton(element, 'Favorit: TotalEnergies').click();
    await context.settle();

    expect(context.storage.getItem('favoriteIDs')).toBe('["fr-75001001"]');
  });

  it('explains an unknown station', async () => {
    const { element } = await renderStation('fr-unknown');

    context.httpTesting
      .expectOne('/api/stations/fr-unknown')
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
});

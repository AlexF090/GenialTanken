import type { Page } from '@playwright/test';
import type { FixtureStation } from '../fixtures.ts';
import {
  chooseFuel,
  expect,
  favoritesHeading,
  quaiDeLaRapeeStation,
  rueBailleulStation,
  seedFavorites,
  stationCard,
  stationRowButton,
  stationsMap,
  test,
} from '../fixtures.ts';

declare global {
  interface Window {
    sharedData?: ShareData[];
  }
}

/** Lookups of one station (`/api/stations/fr-…`); searches and favorites have other paths. */
const isStationLookup = (url: URL): boolean => url.pathname.startsWith('/api/stations/fr-');

const failStationLookups = (page: Page) =>
  page.route(isStationLookup, route =>
    route.fulfill({
      status: 502,
      json: { statusCode: 502, message: 'The fuel price service is unavailable.' },
    })
  );

const expectUsableCard = async (page: Page, station: FixtureStation) => {
  const card = page.getByRole('article');
  await expect(card.getByRole('heading', { level: 2, name: station.title })).toBeVisible();
  await expect(card.getByRole('region', { name: 'Preise' }).getByRole('listitem')).toHaveCount(6);
  await expect(
    card.getByRole('combobox', { name: `Route zu ${station.title}`, exact: true })
  ).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('Tankstelle wird geladen …')).toHaveCount(0);
};

test.describe('station card', () => {
  test('shows address, opening times and every fuel price of a station', async ({ page }) => {
    await page.goto(`/stations/${quaiDeLaRapeeStation.id}`);

    await expect(page).toHaveTitle('Details – GenialTanken');
    // The card opens in the sheet of the explore page, next to the map, instead of the list.
    await expect(
      page.getByRole('region', { name: 'Tankstellen', exact: true }).getByRole('article')
    ).toBeVisible();
    await expect(stationsMap(page)).toBeVisible();
    // The card shows every fuel type, so the hidden list header with its fuel menu stays hidden.
    await expect(page.getByRole('button', { name: /^Kraftstoff:/ })).toBeHidden();

    const details = page.getByRole('article');
    await expect(
      details.getByRole('heading', { level: 2, name: quaiDeLaRapeeStation.title })
    ).toBeVisible();
    // Without a name the street is the title, so the city names the place below it.
    await expect(details.locator('h2 + p')).toHaveText(quaiDeLaRapeeStation.cityLine);
    await expect(details.getByRole('region', { name: 'Adresse' }).locator('address')).toHaveText(
      `${quaiDeLaRapeeStation.title} ${quaiDeLaRapeeStation.cityLine}`
    );

    const openingTimes = details.getByRole('region', { name: 'Öffnungszeiten' });
    // French open data has no live open state, so none is claimed.
    await expect(openingTimes).not.toContainText('Die Tankstelle ist geöffnet.');
    await expect(openingTimes).not.toContainText('Die Tankstelle hat leider geschlossen.');
    await expect(openingTimes.getByRole('listitem')).toHaveText([
      'Montag: 05:00 - 23:00',
      'Dienstag: 05:00 - 23:00',
      'Mittwoch: 05:00 - 23:00',
      'Donnerstag: 05:00 - 23:00',
      'Freitag: 05:00 - 23:00',
      'Samstag: 05:00 - 23:00',
      'Sonntag: 05:00 - 23:00',
      'Feiertag: keine Angabe',
    ]);

    // Today is marked for screen readers; the public holiday row never is.
    await expect(openingTimes.locator('[aria-current="date"]')).toHaveCount(1);
    await expect(openingTimes.getByRole('listitem').last()).not.toHaveAttribute('aria-current');

    // The fuel of the settings (E5 by default) leads the price board, even without a price.
    const prices = details.getByRole('region', { name: 'Preise' }).getByRole('listitem');
    await expect(prices).toHaveCount(6);
    await expect(prices.nth(0)).toContainText('Super E5');
    await expect(prices.nth(0)).toContainText('Dein Kraftstoff');
    await expect(prices.nth(0)).toContainText('kein Preis');
    await expect(prices.nth(1)).toContainText('2,152 €');
    await expect(prices.nth(1)).toContainText('Super E10');
    await expect(prices.nth(2)).toContainText('2,286 €');
    await expect(prices.nth(2)).toContainText('Super Plus');
    await expect(prices.nth(3)).toContainText('2,391 €');
    await expect(prices.nth(3)).toContainText('Diesel');
    await expect(prices.nth(4)).toContainText('E85');
    await expect(prices.nth(4)).toContainText('kein Preis');
    await expect(prices.nth(5)).toContainText('LPG');
    await expect(prices.nth(5)).toContainText('kein Preis');
    await expect(prices.filter({ hasText: 'Dein Kraftstoff' })).toHaveCount(1);
  });

  test('leads with the fuel chosen in the settings', async ({ page }) => {
    await page.goto('/');
    await chooseFuel(page, 'Diesel');
    await page.goto(`/stations/${quaiDeLaRapeeStation.id}`);

    const prices = page.getByRole('region', { name: 'Preise' }).getByRole('listitem');
    await expect(prices.nth(0)).toContainText('Diesel');
    await expect(prices.nth(0)).toContainText('Dein Kraftstoff');
    await expect(prices.nth(0)).toContainText('2,391 €');
    await expect(prices.nth(1)).toContainText('Super E5');
    await expect(prices.nth(1)).toContainText('kein Preis');
  });

  test('closing the card returns to the list with the station selected', async ({ page }) => {
    await page.goto('/');
    await stationCard(page, rueBailleulStation).getByRole('link').click();
    await expect(page).toHaveURL(`/stations/${rueBailleulStation.id}`);

    await page.getByRole('button', { name: 'Schließen', exact: true }).click();

    await expect(page).toHaveURL('/');
    const rowButton = stationRowButton(stationCard(page, rueBailleulStation), rueBailleulStation);
    await expect(rowButton).toHaveAttribute('aria-current', 'true');
    await expect(rowButton).toBeFocused();
  });

  test('opens a station of the list at once, without asking the API again', async ({ page }) => {
    const stationLookups: string[] = [];
    page.on('request', request => {
      if (isStationLookup(new URL(request.url()))) {
        stationLookups.push(request.url());
      }
    });
    await failStationLookups(page);
    await page.goto('/');

    await stationCard(page, rueBailleulStation)
      .getByRole('link', { name: `Details: ${rueBailleulStation.title}` })
      .click();

    await expect(page).toHaveURL(`/stations/${rueBailleulStation.id}`);
    await expectUsableCard(page, rueBailleulStation);
    await expect(page.getByRole('region', { name: 'Preise' })).toContainText('2,540 €');
    expect(stationLookups).toEqual([]);
  });

  test('a station opened by its link offers to try again when loading fails', async ({ page }) => {
    // Without search results around it, the app knows nothing about the station.
    await page.route(
      url => url.pathname === '/api/stations',
      route => route.fulfill({ json: [] })
    );
    await failStationLookups(page);
    await page.goto(`/stations/${rueBailleulStation.id}`);

    await expect(page.getByRole('alert')).toHaveText(
      'Die Preisdaten sind gerade nicht erreichbar. Bitte versuche es später erneut.'
    );
    await expect(page.getByRole('button', { name: 'Schließen', exact: true })).toBeVisible();

    await page.unroute(isStationLookup);
    await page.getByRole('button', { name: 'Erneut versuchen', exact: true }).click();

    await expectUsableCard(page, rueBailleulStation);
  });

  test('a station opened by its link shows a quiet outline while it loads', async ({ page }) => {
    await page.route(
      url => url.pathname === '/api/stations',
      route => route.fulfill({ json: [] })
    );
    let releaseLookup = (): undefined => undefined;
    const lookupReleased = new Promise<undefined>(resolve => {
      releaseLookup = () => {
        resolve(undefined);
      };
    });
    await page.route(isStationLookup, async route => {
      await lookupReleased;
      await route.fallback();
    });
    const lookupRequested = page.waitForRequest(request => isStationLookup(new URL(request.url())));
    await page.goto(`/stations/${rueBailleulStation.id}`);
    await lookupRequested;

    await expect(
      page.getByRole('status').filter({ hasText: 'Tankstelle wird geladen …' })
    ).toHaveCount(1);
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Schließen', exact: true })).toBeVisible();

    releaseLookup();
    await expectUsableCard(page, rueBailleulStation);
  });

  test('Escape closes the card', async ({ page }) => {
    await page.goto(`/stations/${quaiDeLaRapeeStation.id}`);
    await expect(page.getByRole('region', { name: 'Preise' })).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('article')).toHaveCount(0);
  });

  test('a station from the favorites opens as a card on the map; back returns there', async ({
    page,
  }) => {
    await seedFavorites(page, [quaiDeLaRapeeStation.id]);
    // The favorites list has loaded the station, so its card needs no request of its own.
    await failStationLookups(page);
    await page.goto('/favorites');
    await stationCard(page, quaiDeLaRapeeStation).getByRole('link').click();

    await expect(page).toHaveURL(`/stations/${quaiDeLaRapeeStation.id}`);
    await expect(stationsMap(page)).toBeVisible();
    await expectUsableCard(page, quaiDeLaRapeeStation);

    await page.goBack();
    await expect(page).toHaveURL('/favorites');
    await expect(favoritesHeading(page)).toBeVisible();
    await expect(stationsMap(page)).toBeVisible();
  });

  test('credits the French price data', async ({ page }) => {
    await page.goto(`/stations/${quaiDeLaRapeeStation.id}`);

    await expect(
      page.getByRole('link', { name: 'Preisdaten: prix-carburants.gouv.fr (öffnet in neuem Tab)' })
    ).toHaveAttribute('href', 'https://www.prix-carburants.gouv.fr/');
  });

  test('loads a station opened directly by its URL-encoded id', async ({ page }) => {
    await page.goto(`/stations/${encodeURIComponent(rueBailleulStation.id)}`);

    await expect(
      page.getByRole('article').getByRole('heading', { level: 2, name: rueBailleulStation.title })
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Preise' })).toContainText('2,540 €');
  });

  test('shows an error for a station the API does not know', async ({ page }) => {
    await page.goto('/stations/fr-99999999');

    await expect(page.getByRole('alert')).toHaveText(
      'Die Tankstelle konnte in unserer Datenbank nicht gefunden werden.'
    );
    await expect(page.getByRole('article')).toHaveCount(0);
  });

  test('shares the name, address and link of the card where the browser can share', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.sharedData = [];
      Object.defineProperty(navigator, 'share', {
        value: (data: ShareData) => {
          window.sharedData?.push(data);
          return Promise.resolve();
        },
      });
    });
    await page.goto(`/stations/${quaiDeLaRapeeStation.id}`);

    await page.getByRole('article').getByRole('button', { name: 'Teilen', exact: true }).click();

    await expect
      .poll(() => page.evaluate(() => window.sharedData))
      .toEqual([
        {
          title: quaiDeLaRapeeStation.title,
          text: `${quaiDeLaRapeeStation.title}, ${quaiDeLaRapeeStation.cityLine}`,
          url: new URL(`/stations/${quaiDeLaRapeeStation.id}`, page.url()).href,
        },
      ]);
  });

  test('offers no share button where the browser cannot share', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined });
    });
    await page.goto(`/stations/${quaiDeLaRapeeStation.id}`);

    await expect(page.getByRole('region', { name: 'Preise' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Teilen', exact: true })).toHaveCount(0);
  });
});

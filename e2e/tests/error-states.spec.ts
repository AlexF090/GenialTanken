import type { Page, Route } from '@playwright/test';
import { expect, resultSummary, stationCards, test } from '../fixtures.js';

/** Station searches of the explore page; detail and bulk lookups have their own paths. */
const isStationSearch = (url: URL): boolean => url.pathname === '/api/stations';

const answerStationSearchWith = (page: Page, statusCode: number, message: string) =>
  page.route(isStationSearch, (route: Route) =>
    route.fulfill({ status: statusCode, json: { statusCode, message } })
  );

const stationsError = (page: Page) => page.getByRole('alert');

test.describe('error states', () => {
  test('tells the user when the price data is unavailable', async ({ page }) => {
    await answerStationSearchWith(page, 502, 'The fuel price service is unavailable.');

    await page.goto('/');

    await expect(stationsError(page)).toHaveText(
      'Die Preisdaten sind gerade nicht erreichbar. Bitte versuche es später erneut.'
    );
    await expect(stationCards(page)).toHaveCount(0);
  });

  test('asks the user to wait when the API limits the requests', async ({ page }) => {
    await answerStationSearchWith(page, 429, 'Too many requests.');

    await page.goto('/');

    await expect(stationsError(page)).toHaveText(
      'Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.'
    );
  });

  test('points to the internet connection when the server cannot be reached', async ({ page }) => {
    await page.route(isStationSearch, route => route.abort('internetdisconnected'));

    await page.goto('/');

    await expect(stationsError(page)).toHaveText(
      'Der Server ist nicht erreichbar. Bitte prüfe deine Internetverbindung.'
    );
  });

  test.describe('without location permission', () => {
    test.use({ permissions: [] });

    test('explains how to allow the location and keeps the start center', async ({ page }) => {
      await page.goto('/');
      await expect(resultSummary(page)).toContainText('um Eiffelturm, Paris');

      await page.getByRole('button', { name: 'Meinen Standort verwenden' }).click();

      const locationError = page.getByRole('alert');
      await expect(locationError).toHaveText(
        'Der Zugriff auf deinen Standort wurde verweigert. Erlaube ihn in den Einstellungen deines Browsers, um Tankstellen in deiner Nähe zu sehen.'
      );
      await expect(resultSummary(page)).toContainText('um Eiffelturm, Paris');

      await page.getByRole('button', { name: 'Hinweis schließen' }).click();
      await expect(locationError).toBeHidden();
    });
  });

  test('says so when no place matches the search', async ({ page }) => {
    await page.goto('/');
    const searchField = page.getByRole('combobox', { name: 'Ort suchen' });

    // One input event, so only the recorded query reaches the (mocked) place search.
    await searchField.fill('Xyzzy Nirgendwo');

    await expect(page.getByRole('search').getByRole('status')).toHaveText(
      'Keine passenden Orte gefunden.'
    );
    await expect(page.getByRole('listbox', { name: 'Orte' }).getByRole('option')).toHaveCount(0);
  });
});

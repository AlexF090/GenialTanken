import { expect, quaiDeLaRapeeStation, rueBailleulStation, test } from '../fixtures.js';

test.describe('detail page', () => {
  test('shows address, opening times and every fuel price of a station', async ({ page }) => {
    await page.goto(`/stations/${quaiDeLaRapeeStation.id}`);

    await expect(page).toHaveTitle('Details – GenialTanken');
    await expect(page.getByRole('heading', { level: 1, name: 'Details' })).toBeVisible();
    // The detail page shows every fuel type, so the header has no fuel label.
    await expect(page.getByText(/^Kraftstoff:/)).toHaveCount(0);

    const details = page.getByRole('article');
    await expect(
      details.getByRole('heading', { level: 2, name: quaiDeLaRapeeStation.title })
    ).toBeVisible();
    await expect(
      details.getByText(`${quaiDeLaRapeeStation.title} ${quaiDeLaRapeeStation.cityLine}`, {
        exact: true,
      })
    ).toBeVisible();
    await expect(
      details.getByRole('region', { name: `Karte: Lage von ${quaiDeLaRapeeStation.title}` })
    ).toBeVisible();

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

    const prices = details.getByRole('region', { name: 'Preise' }).getByRole('listitem');
    await expect(prices).toHaveCount(6);
    await expect(prices.nth(0)).toHaveText('Kein Preis für Super E5 vorhanden');
    await expect(prices.nth(1)).toContainText('2,152 €');
    await expect(prices.nth(1)).toContainText('Super E10');
    await expect(prices.nth(2)).toContainText('2,286 €');
    await expect(prices.nth(2)).toContainText('Super Plus');
    await expect(prices.nth(3)).toContainText('2,391 €');
    await expect(prices.nth(3)).toContainText('Diesel');
    await expect(prices.nth(4)).toHaveText('Kein Preis für E85 vorhanden');
    await expect(prices.nth(5)).toHaveText('Kein Preis für LPG vorhanden');
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

    await expect(page.getByRole('heading', { level: 1, name: 'Details' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveText(
      'Die Tankstelle konnte in unserer Datenbank nicht gefunden werden.'
    );
    await expect(page.getByRole('article')).toHaveCount(0);
  });
});

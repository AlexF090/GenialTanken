import {
  aralStation,
  expect,
  formatPrice,
  independentStation,
  shellStation,
  test,
} from '../fixtures.js';

test.describe('detail page', () => {
  test('shows address, opening times and all fuel prices of a station', async ({ page }) => {
    await page.goto(`/${aralStation.id}`);

    await expect(page.getByRole('heading', { level: 1, name: 'Details' })).toBeVisible();
    // The detail header receives no fuel label.
    await expect(page.getByRole('heading', { level: 2, name: 'E5' })).toHaveCount(0);

    const details = page.getByRole('article');
    await expect(details.locator('.leaflet-container')).toBeVisible();
    await expect(details.getByText(aralStation.brand ?? '', { exact: true })).toBeVisible();
    await expect(details.getByText(aralStation.name, { exact: true })).toBeVisible();
    await expect(details.getByText('Wilhelmshöher Allee 100')).toBeVisible();
    await expect(details.getByText('34119 Kassel')).toBeVisible();

    await expect(
      details.getByRole('heading', { level: 2, name: 'Die Tankstelle ist geöffnet.' })
    ).toBeVisible();
    const openingDays = details.getByRole('list').first().getByRole('listitem');
    await expect(openingDays).toHaveText([
      'Montag: 06:00 - 22:00',
      'Dienstag: 06:00 - 22:00',
      'Mittwoch: 06:00 - 22:00',
      'Donnerstag: 06:00 - 22:00',
      'Freitag: 06:00 - 22:00',
      'Samstag: 06:00 - 22:00',
      'Sonntag: 06:00 - 22:00',
    ]);

    const prices = details.getByRole('listitem').filter({ hasNotText: ':' });
    await expect(prices).toHaveText([
      `${formatPrice(aralStation.fuelPrices.diesel?.price ?? 0)} Diesel`,
      `${formatPrice(aralStation.fuelPrices.e5?.price ?? 0)} Super E5`,
      `${formatPrice(aralStation.fuelPrices.e10?.price ?? 0)} Super E10`,
    ]);
  });

  test('shows the closed state of a station', async ({ page }) => {
    await page.goto(`/${shellStation.id}`);

    // "gesschlossen" is a typo in the app, characterized as is.
    await expect(
      page.getByRole('heading', { level: 2, name: 'Die Tankstelle hat leider gesschlossen.' })
    ).toBeVisible();
  });

  test('crashes for a station without an E10 price', async ({ page }) => {
    // Known bug: GasStationDetail reads `fuelPrices.e10.price` before its null check, so
    // the whole React tree unmounts and the "Kein Preis für Super E10 vorhanden" branch
    // is unreachable.
    const pageError = page.waitForEvent('pageerror');

    await page.goto(`/${independentStation.id}`);

    expect((await pageError).message).toContain("reading 'price'");
    await expect(page.getByRole('heading', { level: 1, name: 'Details' })).toHaveCount(0);
    await expect(page.getByRole('navigation')).toHaveCount(0);
  });

  test('shows an error for an id the API does not know', async ({ page }) => {
    await page.goto('/unknown-station');

    await expect(page.getByRole('heading', { level: 1, name: 'Details' })).toBeVisible();
    await expect(
      page.getByRole('heading', {
        level: 3,
        name: 'Die Tankstelle konnte in unserer Datenbank nicht gefunden werden',
      })
    ).toBeVisible();
  });
});

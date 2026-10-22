import {
  expect,
  favoritesHeading,
  favoritesRow,
  openedStationCard,
  pageHeading,
  rueBailleulStation,
  seedFavorites,
  settingsButton,
  settingsDialog,
  stationsMap,
  test,
} from '../fixtures.ts';

// No navigation bar: the map is the app, everything else opens from its sheet, and every one of
// these states has a URL of its own that opens it directly.
test.describe('entry points', () => {
  test('the app has no navigation bar', async ({ page }) => {
    await page.goto('/');

    await expect(pageHeading(page, 'GenialTanken')).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
  });

  test('the settings open from the round button of the sheet header', async ({ page }) => {
    await page.goto('/');

    await settingsButton(page).click();

    await expect(page).toHaveURL('/settings');
    await expect(page).toHaveTitle('Einstellungen – GenialTanken');
    await expect(settingsDialog(page)).toBeVisible();

    await settingsDialog(page).getByRole('button', { name: 'Schließen', exact: true }).click();
    await expect(page).toHaveURL('/');
    await expect(page).toHaveTitle('GenialTanken');
    await expect(settingsButton(page)).toBeFocused();
  });

  test('all favorites open from "Alle" of the favorites row', async ({ page }) => {
    await seedFavorites(page, [rueBailleulStation.id]);
    await page.goto('/');

    await favoritesRow(page).getByRole('link', { name: 'Alle Favoriten', exact: true }).click();

    await expect(page).toHaveURL('/favorites');
    await expect(page).toHaveTitle('Favoriten – GenialTanken');
    await expect(favoritesHeading(page)).toBeFocused();
  });

  test('/favorites opens the favorites over the map', async ({ page }) => {
    await page.goto('/favorites');

    await expect(favoritesHeading(page)).toBeVisible();
    await expect(stationsMap(page)).toBeVisible();
  });

  test('/settings opens the settings dialog over the map', async ({ page }) => {
    await page.goto('/settings');

    await expect(settingsDialog(page)).toBeVisible();
    await expect(pageHeading(page, 'GenialTanken')).toBeAttached();
  });

  test('/stations/:id opens the card of the station over the map', async ({ page }) => {
    await page.goto(`/stations/${rueBailleulStation.id}`);

    await expect(
      openedStationCard(page).getByRole('heading', { level: 2, name: rueBailleulStation.title })
    ).toBeVisible();
    await expect(stationsMap(page)).toBeVisible();
  });

  test('the former map page redirects to the explore page', async ({ page }) => {
    await page.goto('/map');

    await expect(page).toHaveURL('/');
    await expect(page).toHaveTitle('GenialTanken');
    await expect(pageHeading(page, 'GenialTanken')).toBeVisible();
    await expect(stationsMap(page)).toBeVisible();
  });

  test('an unknown URL links back to the map', async ({ page }) => {
    await page.goto('/unknown');

    await page.getByRole('link', { name: 'Zur Karte', exact: true }).click();

    await expect(page).toHaveURL('/');
    await expect(stationsMap(page)).toBeVisible();
  });
});

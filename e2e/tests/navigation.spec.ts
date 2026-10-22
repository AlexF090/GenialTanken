import {
  expect,
  favoritesHeading,
  mainNavigation,
  pageHeading,
  rueBailleulStation,
  settingsDialog,
  stationsMap,
  test,
} from '../fixtures.ts';

test.describe('navigation', () => {
  test('the main navigation reaches every page and marks the current one', async ({ page }) => {
    await page.goto('/');
    const navigation = mainNavigation(page);
    const exploreLink = navigation.getByRole('link', { name: 'Erkunden', exact: true });
    const favoritesLink = navigation.getByRole('link', { name: 'Favoriten', exact: true });
    const settingsLink = navigation.getByRole('link', { name: 'Einstellungen', exact: true });

    await expect(navigation.getByRole('link')).toHaveCount(3);
    await expect(pageHeading(page, 'GenialTanken')).toBeVisible();
    await expect(exploreLink).toHaveAttribute('aria-current', 'page');
    await expect(favoritesLink).not.toHaveAttribute('aria-current');
    await expect(settingsLink).not.toHaveAttribute('aria-current');

    await favoritesLink.click();
    await expect(page).toHaveURL('/favorites');
    await expect(page).toHaveTitle('Favoriten – GenialTanken');
    await expect(favoritesHeading(page)).toBeVisible();
    await expect(favoritesLink).toHaveAttribute('aria-current', 'page');
    await expect(exploreLink).not.toHaveAttribute('aria-current');

    await settingsLink.click();
    await expect(page).toHaveURL('/settings');
    await expect(page).toHaveTitle('Einstellungen – GenialTanken');
    await expect(settingsDialog(page)).toBeVisible();
    await expect(settingsLink).toHaveAttribute('aria-current', 'page');
    await expect(favoritesLink).not.toHaveAttribute('aria-current');

    // The dialog makes the navigation inert; closing it returns to the list.
    await settingsDialog(page).getByRole('button', { name: 'Schließen', exact: true }).click();
    await expect(page).toHaveURL('/');
    await expect(page).toHaveTitle('GenialTanken');
    await expect(pageHeading(page, 'GenialTanken')).toBeVisible();
    await expect(exploreLink).toHaveAttribute('aria-current', 'page');
    await expect(settingsLink).not.toHaveAttribute('aria-current');
  });

  test('the sheet header offers the settings next to the navigation', async ({ page }) => {
    await page.goto('/');

    // One link in the navigation, one round button in the header of the sheet
    await expect(page.getByRole('link', { name: 'Einstellungen', exact: true })).toHaveCount(2);
    await expect(
      mainNavigation(page).getByRole('link', { name: 'Einstellungen', exact: true })
    ).toHaveCount(1);
  });

  test('the former map page redirects to the explore page', async ({ page }) => {
    await page.goto('/map');

    await expect(page).toHaveURL('/');
    await expect(page).toHaveTitle('GenialTanken');
    await expect(pageHeading(page, 'GenialTanken')).toBeVisible();
    await expect(stationsMap(page)).toBeVisible();
    await expect(
      mainNavigation(page).getByRole('link', { name: 'Erkunden', exact: true })
    ).toHaveAttribute('aria-current', 'page');
  });

  test('no navigation link is current while a station card is open', async ({ page }) => {
    await page.goto(`/stations/${rueBailleulStation.id}`);

    await expect(
      page.getByRole('article').getByRole('heading', { level: 2, name: rueBailleulStation.title })
    ).toBeVisible();
    await expect(mainNavigation(page).locator('[aria-current]')).toHaveCount(0);
  });
});

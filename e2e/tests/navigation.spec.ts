import { expect, mainNavigation, rueBailleulStation, test } from '../fixtures.js';

test.describe('navigation', () => {
  test('the main navigation reaches every page and marks the current one', async ({ page }) => {
    await page.goto('/');
    const navigation = mainNavigation(page);
    const exploreLink = navigation.getByRole('link', { name: 'Erkunden', exact: true });
    const favoritesLink = navigation.getByRole('link', { name: 'Favoriten', exact: true });
    const settingsLink = navigation.getByRole('link', { name: 'Einstellungen', exact: true });

    await expect(navigation.getByRole('link')).toHaveCount(3);
    // The settings are only part of the navigation, there is no second link in a header.
    await expect(page.getByRole('link', { name: 'Einstellungen' })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'GenialTanken' })).toBeVisible();
    await expect(exploreLink).toHaveAttribute('aria-current', 'page');
    await expect(favoritesLink).not.toHaveAttribute('aria-current');
    await expect(settingsLink).not.toHaveAttribute('aria-current');

    await favoritesLink.click();
    await expect(page).toHaveURL('/favorites');
    await expect(page).toHaveTitle('Favoriten – GenialTanken');
    await expect(page.getByRole('heading', { level: 1, name: 'Favoriten' })).toBeVisible();
    await expect(favoritesLink).toHaveAttribute('aria-current', 'page');
    await expect(exploreLink).not.toHaveAttribute('aria-current');

    await settingsLink.click();
    await expect(page).toHaveURL('/settings');
    await expect(page).toHaveTitle('Einstellungen – GenialTanken');
    await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
    await expect(settingsLink).toHaveAttribute('aria-current', 'page');
    await expect(favoritesLink).not.toHaveAttribute('aria-current');

    await exploreLink.click();
    await expect(page).toHaveURL('/');
    await expect(page).toHaveTitle('GenialTanken');
    await expect(page.getByRole('heading', { level: 1, name: 'GenialTanken' })).toBeVisible();
    await expect(exploreLink).toHaveAttribute('aria-current', 'page');
    await expect(settingsLink).not.toHaveAttribute('aria-current');
  });

  test('the former map page redirects to the explore page', async ({ page }) => {
    await page.goto('/map');

    await expect(page).toHaveURL('/');
    await expect(page).toHaveTitle('GenialTanken');
    await expect(page.getByRole('heading', { level: 1, name: 'GenialTanken' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Karte der Tankstellen' })).toBeVisible();
    await expect(
      mainNavigation(page).getByRole('link', { name: 'Erkunden', exact: true })
    ).toHaveAttribute('aria-current', 'page');
  });

  test('no navigation link is current on a detail page', async ({ page }) => {
    await page.goto(`/stations/${rueBailleulStation.id}`);

    await expect(page.getByRole('heading', { level: 1, name: 'Details' })).toBeVisible();
    await expect(mainNavigation(page).locator('[aria-current]')).toHaveCount(0);
  });
});

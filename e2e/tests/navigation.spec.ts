import { expect, test } from '../fixtures.js';

test.describe('navigation', () => {
  test('the navigation bar and the header settings link reach every page', async ({ page }) => {
    await page.goto('/');
    const navigation = page.getByRole('navigation', { name: 'Hauptnavigation' });
    const startLink = navigation.getByRole('link', { name: 'Start' });
    const mapLink = navigation.getByRole('link', { name: 'Karte' });
    const favoritesLink = navigation.getByRole('link', { name: 'Favoriten' });
    const settingsLink = page.getByRole('link', { name: 'Einstellungen' });

    await expect(page.getByRole('heading', { level: 1, name: 'GenialTanken' })).toBeVisible();
    await expect(startLink).toHaveAttribute('aria-current', 'page');
    await expect(settingsLink).not.toHaveAttribute('aria-current');

    await mapLink.click();
    await expect(page).toHaveURL('/map');
    await expect(page).toHaveTitle('Karte – GenialTanken');
    await expect(page.getByRole('heading', { level: 1, name: 'Karte' })).toBeVisible();
    await expect(mapLink).toHaveAttribute('aria-current', 'page');
    await expect(startLink).not.toHaveAttribute('aria-current');

    await favoritesLink.click();
    await expect(page).toHaveURL('/favorites');
    await expect(page).toHaveTitle('Favoriten – GenialTanken');
    await expect(page.getByRole('heading', { level: 1, name: 'Favoriten' })).toBeVisible();
    await expect(favoritesLink).toHaveAttribute('aria-current', 'page');
    await expect(mapLink).not.toHaveAttribute('aria-current');

    await settingsLink.click();
    await expect(page).toHaveURL('/settings');
    await expect(page).toHaveTitle('Einstellungen – GenialTanken');
    await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
    await expect(settingsLink).toHaveAttribute('aria-current', 'page');
    await expect(favoritesLink).not.toHaveAttribute('aria-current');

    await startLink.click();
    await expect(page).toHaveURL('/');
    await expect(page).toHaveTitle('GenialTanken');
    await expect(page.getByRole('heading', { level: 1, name: 'GenialTanken' })).toBeVisible();
    await expect(startLink).toHaveAttribute('aria-current', 'page');
  });
});

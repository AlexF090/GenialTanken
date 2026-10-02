import { expect, test } from '../fixtures.js';

test.describe('navigation', () => {
  test('the nav bar and the header settings link reach every page', async ({ page }) => {
    await page.goto('/');
    const navigation = page.getByRole('navigation');
    const startLink = navigation.getByRole('link', { name: 'Start' });
    const mapLink = navigation.getByRole('link', { name: 'Karte' });
    const favoritesLink = navigation.getByRole('link', { name: 'Favoriten' });

    await expect(page.getByRole('heading', { level: 1, name: 'GenialTanken' })).toBeVisible();
    await expect(startLink).toHaveAttribute('aria-current', 'page');

    await mapLink.click();
    await expect(page).toHaveURL('/map');
    await expect(page.getByRole('heading', { level: 1, name: 'Karte' })).toBeVisible();
    await expect(mapLink).toHaveAttribute('aria-current', 'page');
    await expect(startLink).not.toHaveAttribute('aria-current', 'page');

    await favoritesLink.click();
    await expect(page).toHaveURL('/favorites');
    await expect(page.getByRole('heading', { level: 1, name: 'Favoriten' })).toBeVisible();
    await expect(favoritesLink).toHaveAttribute('aria-current', 'page');

    // The settings entry is an <a> with role="button" in the header, not part of the nav bar.
    await page.getByRole('button', { name: 'Einstellungen' }).click();
    await expect(page).toHaveURL('/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Einstellungen' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    await startLink.click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1, name: 'GenialTanken' })).toBeVisible();
  });
});

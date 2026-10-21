import { expect, test } from '../fixtures.js';

const UNKNOWN_PATHS = ['/foo', '/a/b/c', '/stations'] as const;

test.describe('page not found', () => {
  for (const unknownPath of UNKNOWN_PATHS) {
    test(`renders the 404 page for ${unknownPath}`, async ({ page }) => {
      await page.goto(unknownPath);

      await expect(page).toHaveTitle('Seite nicht gefunden – GenialTanken');
      await expect(page.getByRole('heading', { level: 1, name: 'GenialTanken' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'ERROR 404' })).toBeVisible();
      await expect(page.getByText('Diese Seite existiert nicht', { exact: true })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();

      await page.getByRole('link', { name: 'Zur Startseite' }).click();

      await expect(page).toHaveURL('/');
      await expect(page.getByRole('heading', { level: 1, name: 'GenialTanken' })).toBeVisible();
    });
  }
});

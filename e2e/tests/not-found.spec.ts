import { expect, pageHeading, stationsMap, test } from '../fixtures.ts';

const UNKNOWN_PATHS = ['/foo', '/a/b/c', '/stations'] as const;

test.describe('page not found', () => {
  for (const unknownPath of UNKNOWN_PATHS) {
    test(`renders the 404 page for ${unknownPath}`, async ({ page }) => {
      await page.goto(unknownPath);

      await expect(page).toHaveTitle('Seite nicht gefunden – GenialTanken');
      await expect(pageHeading(page, 'GenialTanken')).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Fehler 404' })).toBeVisible();
      await expect(page.getByText('Diese Seite existiert nicht', { exact: true })).toBeVisible();
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(stationsMap(page)).toHaveCount(0);

      await page.getByRole('link', { name: 'Zur Karte', exact: true }).click();

      await expect(page).toHaveURL('/');
      await expect(pageHeading(page, 'GenialTanken')).toBeVisible();
    });
  }
});

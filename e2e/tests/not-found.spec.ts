import { expect, test } from '../fixtures.js';

test.describe('page not found', () => {
  test('renders the 404 page for a path with more than one segment', async ({ page }) => {
    // Single-segment paths such as /unknown are caught by the `/:id` detail route
    // (see detail.spec.ts), so only deeper paths reach the catch-all route.
    await page.goto('/unknown/deep/route');

    await expect(page.getByRole('heading', { level: 1, name: 'GenialTanken' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'E5' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'ERROR 404' })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 4, name: 'Diese Seite existiert nicht' })
    ).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
  });
});

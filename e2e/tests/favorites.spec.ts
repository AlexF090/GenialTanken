import {
  aralStation,
  expect,
  favoriteStar,
  listName,
  shellStation,
  stationListItem,
  stationListItems,
  storedFavoriteIds,
  test,
} from '../fixtures.js';

test.describe('favorites', () => {
  test('shows an empty state without favorites', async ({ page }) => {
    await page.goto('/favorites');

    await expect(page.getByRole('heading', { level: 1, name: 'Favoriten' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Keine Favoriten gespeichert' })).toBeVisible();
  });

  test('a starred station appears on /favorites, survives a reload and can be removed', async ({
    page,
  }) => {
    await page.goto('/');
    await favoriteStar(stationListItem(page, aralStation)).click();
    await expect.poll(() => storedFavoriteIds(page)).toEqual([aralStation.id]);

    await page.getByRole('link', { name: 'Favoriten' }).click();
    await expect(stationListItems(page)).toHaveCount(1);
    await expect(stationListItem(page, aralStation)).toContainText(listName(aralStation));
    // The single-station endpoint returns no distance, so no km value is shown.
    await expect(stationListItem(page, aralStation)).not.toContainText('km');

    await page.reload();
    await expect(stationListItems(page)).toHaveCount(1);
    await expect(stationListItem(page, aralStation)).toContainText(listName(aralStation));

    await favoriteStar(stationListItem(page, aralStation)).click();
    await expect(page.getByRole('heading', { name: 'Keine Favoriten gespeichert' })).toBeVisible();
    await expect.poll(() => storedFavoriteIds(page)).toEqual([]);
  });

  test('removing one of several favorites keeps it listed until the page is reopened', async ({
    page,
  }) => {
    await page.goto('/');
    await favoriteStar(stationListItem(page, aralStation)).click();
    await favoriteStar(stationListItem(page, shellStation)).click();
    await expect.poll(() => storedFavoriteIds(page)).toEqual([aralStation.id, shellStation.id]);

    await page.getByRole('link', { name: 'Favoriten' }).click();
    await expect(stationListItems(page)).toHaveCount(2);

    // Known bug: FavoritePage fetches its stations only on mount, so an unstarred
    // station stays in the list (with an outlined star) until the page is opened again.
    await favoriteStar(stationListItem(page, aralStation)).click();
    await expect.poll(() => storedFavoriteIds(page)).toEqual([shellStation.id]);
    await expect(stationListItems(page)).toHaveCount(2);

    await page.getByRole('link', { name: 'Start' }).click();
    await page.getByRole('link', { name: 'Favoriten' }).click();
    await expect(stationListItems(page)).toHaveCount(1);
    await expect(stationListItem(page, shellStation)).toBeVisible();
  });

  test('a station can be starred from its detail page', async ({ page }) => {
    await page.goto(`/${shellStation.id}`);
    await expect(page.getByRole('article')).toContainText(shellStation.name);

    await favoriteStar(page.getByRole('article')).click();
    await expect.poll(() => storedFavoriteIds(page)).toEqual([shellStation.id]);

    await page.getByRole('link', { name: 'Favoriten' }).click();
    await expect(stationListItems(page)).toHaveCount(1);
    await expect(stationListItem(page, shellStation)).toBeVisible();
  });
});

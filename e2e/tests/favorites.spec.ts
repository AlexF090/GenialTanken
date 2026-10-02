import {
  chooseFuel,
  expect,
  favoriteButton,
  openStationList,
  quaiDeLaRapeeStation,
  rueBailleulStation,
  stationCard,
  stationCards,
  storedFavoriteIds,
  test,
} from '../fixtures.js';

test.describe('favorites', () => {
  test('shows an empty state without favorites', async ({ page }) => {
    await page.goto('/favorites');

    await expect(page.getByRole('heading', { level: 1, name: 'Favoriten' })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Keine Favoriten gespeichert' })
    ).toBeVisible();
  });

  test('a station starred in the list is listed on /favorites, survives a reload and can be removed', async ({
    page,
  }) => {
    await page.goto('/');
    const listStar = favoriteButton(stationCard(page, rueBailleulStation), rueBailleulStation);
    await listStar.click();
    await expect(listStar).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => storedFavoriteIds(page)).toEqual([rueBailleulStation.id]);

    await page.getByRole('link', { name: 'Favoriten' }).click();
    await expect(stationCards(page)).toHaveCount(1);
    const favoriteCard = stationCard(page, rueBailleulStation);
    await expect(favoriteCard).toContainText('2,540 €');
    // A single station is loaded without a position, so it has no distance.
    await expect(favoriteCard).not.toContainText('km');

    await page.reload();
    await expect(stationCards(page)).toHaveCount(1);
    const favoriteStar = favoriteButton(stationCard(page, rueBailleulStation), rueBailleulStation);
    await expect(favoriteStar).toHaveAttribute('aria-pressed', 'true');

    await favoriteStar.click();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Keine Favoriten gespeichert' })
    ).toBeVisible();
    await expect.poll(() => storedFavoriteIds(page)).toEqual([]);
  });

  test('unstarring one of several favorites removes it from the list immediately', async ({
    page,
  }) => {
    await page.goto('/');
    await chooseFuel(page, 'Diesel');
    await openStationList(page);
    await favoriteButton(stationCard(page, rueBailleulStation), rueBailleulStation).click();
    await favoriteButton(stationCard(page, quaiDeLaRapeeStation), quaiDeLaRapeeStation).click();
    await expect
      .poll(() => storedFavoriteIds(page))
      .toEqual([rueBailleulStation.id, quaiDeLaRapeeStation.id]);

    await page.getByRole('link', { name: 'Favoriten' }).click();
    await expect(stationCards(page)).toHaveCount(2);

    await favoriteButton(stationCard(page, rueBailleulStation), rueBailleulStation).click();

    await expect(stationCards(page)).toHaveCount(1);
    await expect(stationCard(page, quaiDeLaRapeeStation)).toContainText('2,391 €');
    await expect.poll(() => storedFavoriteIds(page)).toEqual([quaiDeLaRapeeStation.id]);
  });

  test('a station can be starred on its detail page', async ({ page }) => {
    await page.goto(`/stations/${quaiDeLaRapeeStation.id}`);
    const details = page.getByRole('article');
    const detailStar = favoriteButton(details, quaiDeLaRapeeStation);
    await expect(detailStar).toHaveAttribute('aria-pressed', 'false');

    await detailStar.click();
    await expect(detailStar).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => storedFavoriteIds(page)).toEqual([quaiDeLaRapeeStation.id]);

    await page.getByRole('link', { name: 'Favoriten' }).click();
    await expect(stationCards(page)).toHaveCount(1);
    await expect(stationCard(page, quaiDeLaRapeeStation)).toBeVisible();
  });

  test('favorites the API no longer knows are removed with a notice', async ({ page }) => {
    await page.goto('/settings');
    await page.evaluate(() => {
      localStorage.setItem('favoriteIDs', JSON.stringify(['fr-99999999']));
    });

    await page.goto('/favorites');

    await expect(page.getByRole('status').filter({ hasText: 'existiert nicht mehr' })).toHaveText(
      'Eine gespeicherte Tankstelle existiert nicht mehr und wurde aus den Favoriten entfernt.'
    );
    await expect(
      page.getByRole('heading', { level: 2, name: 'Keine Favoriten gespeichert' })
    ).toBeVisible();
    await expect.poll(() => storedFavoriteIds(page)).toEqual([]);
  });
});

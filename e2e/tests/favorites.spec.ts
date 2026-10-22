import type { Page } from '@playwright/test';
import {
  chooseFuel,
  expect,
  favoriteButton,
  mainNavigation,
  openExplore,
  pageHeading,
  quaiDeLaRapeeStation,
  rueBailleulStation,
  seedFavorites,
  stationCard,
  stationCards,
  storedFavoriteIdentifiers,
  test,
  useOwnPosition,
} from '../fixtures.ts';

const openFavorites = (page: Page): Promise<void> =>
  mainNavigation(page).getByRole('link', { name: 'Favoriten', exact: true }).click();

test.describe('favorites', () => {
  test('shows an empty state that leads to the explore page', async ({ page }) => {
    await page.goto('/favorites');

    await expect(pageHeading(page, 'Favoriten')).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Keine Favoriten gespeichert' })
    ).toBeVisible();
    await expect(stationCards(page)).toHaveCount(0);

    await page.getByRole('link', { name: 'Tankstellen erkunden', exact: true }).click();

    await expect(page).toHaveURL('/');
    await expect(pageHeading(page, 'GenialTanken')).toBeVisible();
  });

  test('a station starred in the list is listed on /favorites, survives a reload and can be removed', async ({
    page,
  }) => {
    await page.goto('/');
    const listStar = favoriteButton(stationCard(page, rueBailleulStation), rueBailleulStation);
    await listStar.click();
    await expect(listStar).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => storedFavoriteIdentifiers(page)).toEqual([rueBailleulStation.id]);

    await openFavorites(page);
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
    await expect.poll(() => storedFavoriteIdentifiers(page)).toEqual([]);
  });

  test('unstarring one of several favorites removes it from the list immediately', async ({
    page,
  }) => {
    await page.goto('/');
    await chooseFuel(page, 'Diesel');
    await openExplore(page);
    // Only Rue Bailleul is in range of the Eiffel Tower, where the explore page starts.
    await useOwnPosition(page);
    await favoriteButton(stationCard(page, rueBailleulStation), rueBailleulStation).click();
    await favoriteButton(stationCard(page, quaiDeLaRapeeStation), quaiDeLaRapeeStation).click();
    await expect
      .poll(() => storedFavoriteIdentifiers(page))
      .toEqual([rueBailleulStation.id, quaiDeLaRapeeStation.id]);

    await openFavorites(page);
    await expect(stationCards(page)).toHaveCount(2);

    await favoriteButton(stationCard(page, rueBailleulStation), rueBailleulStation).click();

    await expect(stationCards(page)).toHaveCount(1);
    await expect(stationCard(page, quaiDeLaRapeeStation)).toContainText('2,391 €');
    await expect.poll(() => storedFavoriteIdentifiers(page)).toEqual([quaiDeLaRapeeStation.id]);
  });

  test('a station can be starred on its detail page', async ({ page }) => {
    await page.goto(`/stations/${quaiDeLaRapeeStation.id}`);
    const details = page.getByRole('article');
    const detailStar = favoriteButton(details, quaiDeLaRapeeStation);
    await expect(detailStar).toHaveAttribute('aria-pressed', 'false');

    await detailStar.click();
    await expect(detailStar).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => storedFavoriteIdentifiers(page)).toEqual([quaiDeLaRapeeStation.id]);

    await openFavorites(page);
    await expect(stationCards(page)).toHaveCount(1);
    await expect(stationCard(page, quaiDeLaRapeeStation)).toBeVisible();
  });

  test('loads several favorites with a single request', async ({ page }) => {
    await seedFavorites(page, [rueBailleulStation.id, quaiDeLaRapeeStation.id]);
    const bulkLookups: URL[] = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/api/stations/by-identifiers') {
        bulkLookups.push(url);
      }
    });

    await page.goto('/favorites');

    await expect(stationCards(page)).toHaveCount(2);
    await expect(stationCard(page, rueBailleulStation)).toBeVisible();
    await expect(stationCard(page, quaiDeLaRapeeStation)).toBeVisible();
    expect(bulkLookups).toHaveLength(1);
    expect(bulkLookups[0]?.searchParams.get('identifiers')?.split(',').sort()).toEqual(
      [rueBailleulStation.id, quaiDeLaRapeeStation.id].sort()
    );
  });

  test('keeps favorites the API does not know until the user removes them', async ({ page }) => {
    await seedFavorites(page, ['fr-99999999']);

    await page.goto('/favorites');

    await expect(page.getByRole('status').filter({ hasText: 'nicht verfügbar' })).toHaveText(
      'Ein Favorit ist gerade nicht verfügbar.'
    );
    await expect(
      page.getByRole('heading', { level: 2, name: 'Keine Favoriten gespeichert' })
    ).toBeHidden();
    expect(await storedFavoriteIdentifiers(page)).toEqual(['fr-99999999']);

    await page.getByRole('button', { name: 'Nicht verfügbare Favoriten entfernen' }).click();

    const emptyStateHeading = page.getByRole('heading', {
      level: 2,
      name: 'Keine Favoriten gespeichert',
    });
    await expect(emptyStateHeading).toBeFocused();
    await expect.poll(() => storedFavoriteIdentifiers(page)).toEqual([]);
  });
});

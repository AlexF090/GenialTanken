import type { Locator, Page } from '@playwright/test';
import {
  expect,
  favoriteButton,
  favoritesList,
  favoritesRow,
  openedStationCard,
  quaiDeLaRapeeStation,
  rueBailleulStation,
  seedFavorites,
  settingsButton,
  settingsDialog,
  stationCard,
  stationCards,
  test,
} from '../fixtures.ts';

/** The focused element; it matches nothing while the focus has fallen back to `body`. */
const focusedElement = (page: Page): Locator => page.locator(':focus');

const searchField = (page: Page): Locator => page.getByRole('combobox', { name: 'Ort suchen' });

const startPlaceSearch = async (page: Page): Promise<void> => {
  await searchField(page).pressSequentially('Bastille');
  await expect(
    page.getByRole('listbox', { name: 'Orte' }).getByRole('option').first()
  ).toContainText('Bastille');
};

// Closing returns to the list without a new history entry, so Back never reopens what was closed.
test.describe('closing and the browser history', () => {
  test('Back after closing the settings does not reopen them', async ({ page }) => {
    await page.goto('/');
    await settingsButton(page).click();
    await expect(settingsDialog(page)).toBeVisible();
    await settingsDialog(page).getByRole('button', { name: 'Schließen', exact: true }).click();
    await expect(page).toHaveURL('/');

    await page.goBack();

    await expect(page).not.toHaveURL(/\/settings$/);
    await expect(settingsDialog(page)).toBeHidden();
  });

  test('Back after closing a station card does not reopen it', async ({ page }) => {
    await page.goto('/');
    await stationCard(page, rueBailleulStation).getByRole('link').click();
    await expect(page).toHaveURL(`/stations/${rueBailleulStation.id}`);
    await openedStationCard(page).getByRole('button', { name: 'Schließen', exact: true }).click();
    await expect(page).toHaveURL('/');

    await page.goBack();

    await expect(page).not.toHaveURL(/\/stations\//);
    await expect(openedStationCard(page)).toBeHidden();
  });

  test('Back after closing the favorites does not reopen them', async ({ page }) => {
    await seedFavorites(page, [rueBailleulStation.id]);
    await page.goto('/');
    await favoritesRow(page).getByRole('link', { name: 'Alle Favoriten', exact: true }).click();
    await expect(page).toHaveURL('/favorites');
    await favoritesList(page).getByRole('button', { name: 'Zurück', exact: true }).click();
    await expect(page).toHaveURL('/');

    await page.goBack();

    await expect(page).not.toHaveURL(/\/favorites$/);
    await expect(favoritesList(page)).toBeHidden();
  });
});

test.describe('focus after closing', () => {
  test('Escape in the place search leaves the focus on a control', async ({ page }) => {
    await page.goto('/');
    await startPlaceSearch(page);

    await page.keyboard.press('Escape');

    await expect(page.getByRole('listbox', { name: 'Orte' })).toBeHidden();
    await expect(focusedElement(page)).toBeVisible();
  });

  test('"Abbrechen" in the place search leaves the focus on a control', async ({ page }) => {
    await page.goto('/');
    await startPlaceSearch(page);

    await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();

    await expect(page.getByRole('listbox', { name: 'Orte' })).toBeHidden();
    await expect(focusedElement(page)).toBeVisible();
  });

  test('closing the settings with Escape returns the focus to the settings button', async ({
    page,
  }) => {
    await page.goto('/');
    await settingsButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(
      settingsDialog(page).getByRole('slider', { name: /^Radius: \d+ km$/ })
    ).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(settingsDialog(page)).toBeHidden();
    await expect(page).toHaveURL('/');
    await expect(settingsButton(page)).toBeFocused();
  });

  test('unstarring favorites keeps the focus on a star or a heading of the favorites', async ({
    page,
  }) => {
    await seedFavorites(page, [rueBailleulStation.id, quaiDeLaRapeeStation.id]);
    await page.goto('/favorites');
    await expect(stationCards(page)).toHaveCount(2);

    await favoriteButton(stationCard(page, rueBailleulStation), rueBailleulStation).click();

    await expect(stationCards(page)).toHaveCount(1);
    await expect(focusedElement(page)).toHaveAccessibleName(/^(Favorit: .+|Favoriten)$/);

    await favoriteButton(stationCard(page, quaiDeLaRapeeStation), quaiDeLaRapeeStation).click();

    await expect(stationCards(page)).toHaveCount(0);
    await expect(focusedElement(page)).toHaveAccessibleName(
      /^(Favoriten|Keine Favoriten gespeichert)$/
    );
  });
});

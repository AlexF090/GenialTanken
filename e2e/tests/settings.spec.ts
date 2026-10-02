import {
  aralStation,
  expect,
  formatPrice,
  independentStation,
  jetStation,
  listName,
  shellStation,
  stationListItem,
  stationListItems,
  test,
} from '../fixtures.js';
import type { Page } from '@playwright/test';

/**
 * Loads the station list first and then opens the settings via the header link
 * (client-side navigation keeps the already fetched stations in memory).
 */
const openSettingsAfterStationsLoaded = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(stationListItems(page)).toHaveCount(3);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
};

test.describe('settings', () => {
  test('shows the fuel options with E5 selected and a 5 km radius', async ({ page }) => {
    await openSettingsAfterStationsLoaded(page);

    await expect(page.getByRole('radio', { name: 'E5' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'E10' })).not.toBeChecked();
    await expect(page.getByRole('radio', { name: 'Diesel' })).not.toBeChecked();
    await expect(page.getByRole('heading', { name: 'Radius: 5 km' })).toBeVisible();
    await expect(page.getByRole('slider')).toHaveValue('5');
    await expect(page.getByRole('button', { name: 'Speichern' })).toBeVisible();
  });

  test('changing the radius updates the radius label', async ({ page }) => {
    await openSettingsAfterStationsLoaded(page);

    await page.getByRole('slider').fill('15');

    await expect(page.getByRole('heading', { name: 'Radius: 15 km' })).toBeVisible();
  });

  test('switching to E10 updates the header label and filters the list', async ({ page }) => {
    await openSettingsAfterStationsLoaded(page);

    await page.getByRole('radio', { name: 'E10' }).check();
    await expect(page.getByRole('heading', { level: 2, name: 'E10' })).toBeVisible();

    // Known bug: "Speichern" only re-reads the geolocation. Latitude and longitude do not
    // change, so the stations are not fetched again with the new fuel type.
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.getByRole('link', { name: 'Start' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'E10' })).toBeVisible();
    await expect(stationListItems(page)).toHaveCount(2);
    await expect(stationListItem(page, aralStation)).toContainText(
      formatPrice(aralStation.fuelPrices.e10?.price ?? 0)
    );
    await expect(stationListItem(page, shellStation)).toContainText(
      formatPrice(shellStation.fuelPrices.e10?.price ?? 0)
    );
    // Without an E10 price the station is hidden by the list's own filter.
    await expect(page.getByText(listName(independentStation))).toHaveCount(0);
    // Known bug (see above): JET has an E10 price but was already dropped by the E5 fetch filter.
    await expect(page.getByText(listName(jetStation))).toHaveCount(0);
  });

  test('switching to Diesel shows diesel prices for all fetched stations', async ({ page }) => {
    await openSettingsAfterStationsLoaded(page);

    await page.getByRole('radio', { name: 'Diesel' }).check();
    await expect(page.getByRole('heading', { level: 2, name: 'Diesel' })).toBeVisible();
    await page.getByRole('link', { name: 'Start' }).click();

    await expect(stationListItems(page)).toHaveCount(3);
    await expect(stationListItem(page, independentStation)).toContainText(
      formatPrice(independentStation.fuelPrices.diesel?.price ?? 0)
    );
  });

  test('the fuel choice is not persisted across a reload', async ({ page }) => {
    await openSettingsAfterStationsLoaded(page);
    await page.getByRole('radio', { name: 'E10' }).check();
    await expect(page.getByRole('heading', { level: 2, name: 'E10' })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('radio', { name: 'E5' })).toBeChecked();
    await expect(page.getByRole('heading', { level: 2, name: 'E5' })).toBeVisible();
  });
});

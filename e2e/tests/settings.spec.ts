import type { Page } from '@playwright/test';
import {
  chooseFuel,
  expect,
  FUEL_OPTION_LABELS,
  openSettings,
  openStationList,
  rueBailleulStation,
  stationCard,
  stationCards,
  test,
} from '../fixtures.js';

const fuelOptions = (page: Page) => page.getByRole('group', { name: 'Kraftstoff' });

test.describe('settings', () => {
  test('offers every fuel type with E5 selected and a 5 km radius by default', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
    await expect(fuelOptions(page).getByRole('radio')).toHaveCount(FUEL_OPTION_LABELS.length);
    for (const fuel of FUEL_OPTION_LABELS) {
      const radio = fuelOptions(page).getByRole('radio', { name: fuel, exact: true });
      await (fuel === 'E5' ? expect(radio).toBeChecked() : expect(radio).not.toBeChecked());
    }

    const radiusSlider = page.getByRole('slider', { name: 'Radius: 5 km' });
    await expect(radiusSlider).toHaveValue('5');
    await expect(radiusSlider).toHaveAttribute('min', '1');
    await expect(radiusSlider).toHaveAttribute('max', '25');
    // Changes apply immediately, so there is nothing to submit.
    await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
  });

  test('changes apply immediately and survive a reload', async ({ page }) => {
    await page.goto('/settings');

    await fuelOptions(page).getByRole('radio', { name: 'E10', exact: true }).check();
    await page.getByRole('slider').fill('12');

    await expect(page.getByText('Kraftstoff: E10', { exact: true })).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Radius: 12 km' })).toHaveValue('12');

    await page.reload();

    await expect(fuelOptions(page).getByRole('radio', { name: 'E10', exact: true })).toBeChecked();
    await expect(page.getByRole('slider', { name: 'Radius: 12 km' })).toHaveValue('12');
    await expect(page.getByText('Kraftstoff: E10', { exact: true })).toBeVisible();
  });

  test('changing the radius refetches the stations within the new radius', async ({ page }) => {
    await page.goto('/');
    await chooseFuel(page, 'Diesel');
    await openStationList(page);
    await expect(stationCards(page)).toHaveCount(4);

    await openSettings(page);
    await page.getByRole('slider').fill('1');
    await expect(page.getByRole('slider', { name: 'Radius: 1 km' })).toHaveValue('1');
    await openStationList(page);

    await expect(stationCards(page)).toHaveCount(1);
    await expect(stationCard(page, rueBailleulStation)).toContainText(rueBailleulStation.distance);

    await chooseFuel(page, 'E10');
    await openStationList(page);

    await expect(stationCards(page)).toHaveCount(0);
    await expect(
      page.getByText('Keine Tankstellen mit Preis für E10 im Umkreis von 1 km gefunden.')
    ).toBeVisible();
  });
});

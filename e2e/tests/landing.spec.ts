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

test.describe('landing page', () => {
  test('lists the stations around the current position with E5 as default fuel', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'GenialTanken' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'E5' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Unterstüzt von TankenTanken.de' })
    ).toHaveAttribute('href', 'https://www.tankentanken.de/');

    // The JET station has no E5 price and is dropped by the filter applied while fetching.
    await expect(stationListItems(page)).toHaveCount(3);
    await expect(stationListItems(page)).toContainText([
      listName(aralStation),
      listName(shellStation),
      listName(independentStation),
    ]);
    await expect(page.getByText(listName(jetStation))).toHaveCount(0);

    const aralItem = stationListItem(page, aralStation);
    await expect(aralItem).toContainText(formatPrice(aralStation.fuelPrices.e5?.price ?? 0));
    await expect(aralItem).toContainText('Wilhelmshöher Allee 100');
    await expect(aralItem).toContainText('34119 Kassel');
    await expect(aralItem).toContainText('0.85 km');

    // Distance is truncated, not rounded: 1949 m is shown as 1.94 km.
    await expect(stationListItem(page, shellStation)).toContainText('1.94 km');

    // Stations without a brand show the name, truncated to 14 characters plus an ellipsis.
    await expect(stationListItem(page, independentStation)).toContainText('Freie Tankstel...');
  });

  test('each station card links to its detail page', async ({ page }) => {
    await page.goto('/');

    await stationListItem(page, shellStation).getByRole('link').click();

    await expect(page).toHaveURL(`/${shellStation.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Details' })).toBeVisible();
  });

  test('toggles between API order (km) and ascending E5 price', async ({ page }) => {
    await page.goto('/');
    await expect(stationListItems(page)).toHaveCount(3);

    const sortButton = page.getByRole('button', { name: /^Sortiert nach:/ });
    await expect(sortButton).toHaveText('Sortiert nach: km');
    await expect(stationListItems(page)).toContainText([
      listName(aralStation),
      listName(shellStation),
      listName(independentStation),
    ]);

    await sortButton.click();
    await expect(sortButton).toHaveText('Sortiert nach: Preis');
    await expect(stationListItems(page)).toContainText([
      listName(independentStation),
      listName(shellStation),
      listName(aralStation),
    ]);

    await sortButton.click();
    await expect(sortButton).toHaveText('Sortiert nach: km');
    await expect(stationListItems(page)).toContainText([
      listName(aralStation),
      listName(shellStation),
      listName(independentStation),
    ]);
  });

  test('offers a reload button for the current position', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'aktualisieren' })).toBeVisible();
  });
});

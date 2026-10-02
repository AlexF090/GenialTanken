import {
  chooseFuel,
  expect,
  quaiDeLaRapeeStation,
  rueBailleulStation,
  stationCards,
  test,
} from '../fixtures.js';

test.describe('map page', () => {
  test('shows the own position and opens the detail page from a marker popup', async ({ page }) => {
    await page.goto('/map');

    await expect(page.getByRole('heading', { level: 1, name: 'Karte' })).toBeVisible();
    await expect(page.getByText('Kraftstoff: E5', { exact: true })).toBeVisible();
    const map = page.getByRole('region', { name: 'Karte der Tankstellen in deiner Nähe' });
    await expect(map).toBeVisible();
    await expect(map.getByText('Du bist hier!', { exact: true })).toBeVisible();

    const marker = map.getByRole('button', { name: `${rueBailleulStation.title}, 2,540 €` });
    await marker.click();
    const popupLink = map.getByRole('link', { name: 'Mehr Anzeigen' });
    await expect(popupLink).toHaveAttribute('href', `/stations/${rueBailleulStation.id}`);
    await popupLink.click();

    await expect(page).toHaveURL(`/stations/${rueBailleulStation.id}`);
    await expect(
      page.getByRole('article').getByRole('heading', { level: 2, name: rueBailleulStation.title })
    ).toBeVisible();
  });

  test('shows a marker for every station of the selected fuel type', async ({ page }) => {
    await page.goto('/map');
    await chooseFuel(page, 'Diesel');
    await page.getByRole('link', { name: 'Karte' }).click();

    const map = page.getByRole('region', { name: 'Karte der Tankstellen in deiner Nähe' });
    await expect(
      map.getByRole('button', { name: `${rueBailleulStation.title}, 2,680 €` })
    ).toBeVisible();
    await expect(
      map.getByRole('button', { name: `${quaiDeLaRapeeStation.title}, 2,391 €` })
    ).toBeVisible();
    // The two stations in the 13th arrondissement are close enough to form a cluster.
    const cluster = map.getByRole('button', { name: '2', exact: true });
    await expect(cluster).toBeVisible();
  });

  test('links to the station list', async ({ page }) => {
    await page.goto('/map');

    await page.getByRole('link', { name: 'Tankstellen als Liste anzeigen' }).click();

    await expect(page).toHaveURL('/');
    await expect(stationCards(page)).toHaveCount(1);
  });
});

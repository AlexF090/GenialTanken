import { aralStation, expect, formatPrice, stationListItems, test } from '../fixtures.js';

test.describe('map page', () => {
  test('clusters the station markers and opens a detail page from a marker popup', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(stationListItems(page)).toHaveCount(3);
    await page.getByRole('link', { name: 'Karte' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Karte' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'E5' })).toBeVisible();
    // Leaflet internals have no semantic roles, so the container is located by class.
    await expect(page.locator('.leaflet-container')).toBeVisible();

    // The own position is an unclustered marker with a permanently open popup.
    await expect(page.getByText('Du bist hier !')).toBeVisible();

    // At the initial zoom level (6, centered on Germany) the three stations form one cluster.
    const cluster = page.getByRole('button', { name: '3', exact: true });
    await expect(cluster).toBeVisible();
    await cluster.click();

    // After zooming in: three station markers plus the own-position marker.
    const markers = page.getByRole('button', { name: 'Marker' });
    await expect(markers).toHaveCount(4);

    // Station popups only open on interaction. Enter triggers a Leaflet click without
    // depending on which marker or popup is on top at a given screen position.
    for (const marker of await markers.all()) {
      await marker.press('Enter');
    }
    await expect(page.getByRole('link', { name: 'Mehr Anzeigen' })).toHaveCount(3);

    const aralPopup = page
      .locator('.leaflet-popup')
      .filter({ hasText: formatPrice(aralStation.fuelPrices.e5?.price ?? 0) });
    await aralPopup.getByRole('link', { name: 'Mehr Anzeigen' }).click();

    await expect(page).toHaveURL(`/${aralStation.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Details' })).toBeVisible();
    await expect(page.getByRole('article')).toContainText(aralStation.name);
  });
});

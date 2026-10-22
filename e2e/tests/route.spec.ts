import { expect, rueBailleulStation, stationCard, test } from '../fixtures.ts';

declare global {
  interface Window {
    openedUrls?: string[];
  }
}

/** Coordinates of Rue Bailleul in `data/france-stations.json`. */
const rueBailleulCoordinates = '48.861,2.341';

test.describe('route to a station', () => {
  test.beforeEach(async ({ page }) => {
    // Records the links instead of leaving the app, which the fixture would block anyway.
    await page.addInitScript(() => {
      window.openedUrls = [];
      window.open = url => {
        window.openedUrls?.push(String(url));
        return null;
      };
    });
  });

  const routeSelect = (page: Parameters<typeof stationCard>[0]) =>
    stationCard(page, rueBailleulStation).getByRole('combobox', {
      name: `Route zu ${rueBailleulStation.title}`,
      exact: true,
    });

  const lastOpenedUrl = async (page: Parameters<typeof stationCard>[0]): Promise<URL> => {
    await expect.poll(() => page.evaluate(() => window.openedUrls?.length)).toBeGreaterThan(0);
    const urls = await page.evaluate(() => window.openedUrls ?? []);
    const url = urls.at(-1);
    if (url === undefined) {
      throw new Error('no link was opened');
    }
    return new URL(url);
  };

  test('opens Apple Karten with the station as destination', async ({ page }) => {
    await page.goto('/');
    await routeSelect(page).selectOption({ label: 'Apple Karten' });

    const url = await lastOpenedUrl(page);
    expect(url.origin).toBe('https://maps.apple.com');
    expect(url.searchParams.get('daddr')).toBe(rueBailleulCoordinates);
    expect(url.searchParams.get('dirflg')).toBe('d');
  });

  test('opens Google Maps with the station as destination', async ({ page }) => {
    await page.goto('/');
    await routeSelect(page).selectOption({ label: 'Google Maps' });

    const url = await lastOpenedUrl(page);
    expect(`${url.origin}${url.pathname}`).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('destination')).toBe(rueBailleulCoordinates);
    expect(url.searchParams.get('travelmode')).toBe('driving');
  });

  test('opens Waze with the station as destination', async ({ page }) => {
    await page.goto('/');
    await routeSelect(page).selectOption({ label: 'Waze' });

    const url = await lastOpenedUrl(page);
    expect(url.origin).toBe('https://waze.com');
    expect(url.searchParams.get('ll')).toBe(rueBailleulCoordinates);
    expect(url.searchParams.get('navigate')).toBe('yes');
  });
});

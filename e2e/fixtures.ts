import { test as base, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Stations of `data/france-stations.json` as the app shows them for a user at the centre of
 * Paris. French open data has neither brand nor name, so the street is the station title.
 * Distances are computed by the API from the user's position; prices are the plain
 * (screen reader) text of the Price component.
 */
export interface FixtureStation {
  id: string;
  title: string;
  cityLine: string;
  distance: string;
}

export const rueBailleulStation: FixtureStation = {
  id: 'fr-75001003',
  title: '8,10,10bis Rue Bailleul',
  cityLine: '75001 Paris',
  distance: '0,95 km',
};

export const quaiDeLaRapeeStation: FixtureStation = {
  id: 'fr-75012010',
  title: '36 Quai de la Rapée',
  cityLine: '75012 Paris',
  distance: '2,23 km',
};

export const boulevardDeLHopitalStation: FixtureStation = {
  id: 'fr-75013024',
  title: '114 BD DE L HOPITAL',
  cityLine: '75013 Paris',
  distance: '2,44 km',
};

export const boulevardVincentAuriolStation: FixtureStation = {
  id: 'fr-75013025',
  title: '181, BOULEVARD VINCENT AURIOL',
  cityLine: '75013 Paris',
  distance: '2,78 km',
};

export const parisCenter = { latitude: 48.8566, longitude: 2.3522 };

export const FUEL_OPTION_LABELS = ['E5', 'E10', 'Super Plus', 'Diesel', 'E85', 'LPG'] as const;

export type FuelOptionLabel = (typeof FUEL_OPTION_LABELS)[number];

const transparentPixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

/**
 * Keeps every test offline and deterministic. Station data comes from the API, which talks to
 * the mock upstream (`mock-upstream.ts`) instead of the French government API; map tiles are a
 * transparent pixel. Any other request leaving the app origin is aborted and recorded, so the
 * test fails. Routes registered later take precedence, so the catch-all comes first.
 */
const mockExternalServices = async (
  page: Page,
  applicationOrigin: string,
  unmockedRequests: string[]
): Promise<void> => {
  await page.route(
    url => url.origin !== applicationOrigin,
    async route => {
      unmockedRequests.push(`${route.request().method()} ${route.request().url()}`);
      await route.abort('blockedbyclient');
    }
  );
  await page.route(
    url => url.protocol === 'https:' && /^([a-z]\.)?tile\.openstreetmap\.org$/.test(url.hostname),
    route => route.fulfill({ body: transparentPixelPng, contentType: 'image/png' })
  );
};

export const test = base.extend({
  geolocation: parisCenter,
  permissions: ['geolocation'],
  page: async ({ page, baseURL }, use) => {
    if (!baseURL) {
      throw new Error('baseURL must be configured in playwright.config.ts');
    }
    const unmockedRequests: string[] = [];
    await mockExternalServices(page, new URL(baseURL).origin, unmockedRequests);
    await use(page);
    expect(unmockedRequests, 'every request outside the app origin must be mocked').toEqual([]);
  },
});

export { expect };

/** Station cards of the list inside the page's main landmark. */
export const stationCards = (page: Page): Locator => page.getByRole('main').getByRole('listitem');

export const stationCard = (page: Page, station: FixtureStation): Locator =>
  stationCards(page).filter({ has: page.getByText(station.title, { exact: true }) });

export const favoriteButton = (container: Locator, station: FixtureStation): Locator =>
  container.getByRole('button', { name: `Favorit: ${station.title}`, exact: true });

/**
 * Opens the settings through the header link. The router attaches the page before its first
 * change detection binds the form, so the test waits for the bound radius label (its first
 * binding) before interacting; otherwise the input is ignored (Angular error NG0950).
 */
export const openSettings = async (page: Page): Promise<void> => {
  await page.getByRole('link', { name: 'Einstellungen' }).click();
  await expect(page.getByRole('slider', { name: /^Radius: \d+ km$/ })).toBeVisible();
};

/** Selects a fuel type on the settings page, which applies it immediately. */
export const chooseFuel = async (page: Page, fuel: FuelOptionLabel): Promise<void> => {
  await openSettings(page);
  await page
    .getByRole('group', { name: 'Kraftstoff' })
    .getByRole('radio', { name: fuel, exact: true })
    .check();
};

/** Opens the list through the navigation, keeping the app state of the current visit. */
export const openStationList = async (page: Page): Promise<void> => {
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Start' })
    .click();
};

export const storedFavoriteIds = (page: Page): Promise<unknown> =>
  page.evaluate((): unknown => JSON.parse(localStorage.getItem('favoriteIDs') ?? 'null'));

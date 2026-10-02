import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';
import type { Locator, Page, Route } from '@playwright/test';
import stationsJson from './data/stations.json' with { type: 'json' };

export interface FuelPrice {
  price: number;
  lastChange: string;
}

export interface FuelPrices {
  e5: FuelPrice | null;
  e10: FuelPrice | null;
  diesel: FuelPrice | null;
}

export interface OpeningTime {
  opening: string;
  closing: string;
}

export interface OpeningTimes {
  monday: OpeningTime[];
  tuesday: OpeningTime[];
  wednesday: OpeningTime[];
  thursday: OpeningTime[];
  friday: OpeningTime[];
  saturday: OpeningTime[];
  sunday: OpeningTime[];
  publicHoliday: OpeningTime[];
}

export interface GasStation {
  id: string;
  name: string;
  brand: string | null;
  address: {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  fuelPrices: FuelPrices;
  isOpen: boolean;
  openingTimes: OpeningTimes;
  publicHolidayIdentifier: string | null;
  mdmVersion: number;
  mdmPriceVersion: number;
  distance: number;
}

export const gasStations: readonly GasStation[] = stationsJson;

const findStation = (id: string): GasStation => {
  const station = gasStations.find(candidate => candidate.id === id);
  if (!station) {
    throw new Error(`Fixture station with id "${id}" does not exist in data/stations.json`);
  }
  return station;
};

/** All fuel types; nearest station, most expensive E5. */
export const aralStation = findStation('11111111-1111-4111-8111-111111111111');
/** All fuel types; closed (isOpen false). */
export const shellStation = findStation('22222222-2222-4222-8222-222222222222');
/** No brand (the list shows the truncated name), no E10 price, cheapest E5. */
export const independentStation = findStation('33333333-3333-4333-8333-333333333333');
/** No E5 price, so the default E5 filter applied while fetching drops it. */
export const jetStation = findStation('44444444-4444-4444-8444-444444444444');

export const kasselLocation = { latitude: 51.3127, longitude: 9.4797 };

const STATIONS_API_BASE_URL = 'https://api.tankentanken.de/gas-stations';
const CORS_HEADERS = { 'access-control-allow-origin': '*' };

const transparentPixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

const clientModulesDirectory = fileURLToPath(new URL('../client/node_modules/', import.meta.url));

const readClientStylesheet = (...relativePaths: string[]): string =>
  relativePaths
    .map(relativePath => `${clientModulesDirectory}${relativePath}`)
    .filter(absolutePath => existsSync(absolutePath))
    .map(absolutePath => readFileSync(absolutePath, 'utf8'))
    .join('\n');

const fulfillStationsApi = async (route: Route): Promise<void> => {
  const { pathname } = new URL(route.request().url());
  const stationId = pathname.replace(/^\/gas-stations\/?/, '');

  if (stationId === '') {
    await route.fulfill({ json: gasStations, headers: CORS_HEADERS });
    return;
  }

  const station = gasStations.find(candidate => candidate.id === stationId);
  if (!station) {
    await route.fulfill({
      status: 404,
      json: { message: 'Gas station not found' },
      headers: CORS_HEADERS,
    });
    return;
  }

  // The single-station endpoint has no location context, so it carries no distance.
  const { distance: _distance, ...stationWithoutDistance } = station;
  await route.fulfill({ json: stationWithoutDistance, headers: CORS_HEADERS });
};

const fulfillLeafletImage = async (route: Route): Promise<void> => {
  const imageName = new URL(route.request().url()).pathname.split('/').pop() ?? '';
  const localImagePath = `${clientModulesDirectory}leaflet/dist/images/${imageName}`;
  if (imageName !== '' && existsSync(localImagePath)) {
    await route.fulfill({ path: localImagePath });
    return;
  }
  await route.fulfill({ body: transparentPixelPng, contentType: 'image/png' });
};

/**
 * Makes every test deterministic and offline: the TankenTanken API answers from
 * data/stations.json, Mapbox tiles are a transparent pixel, and the unpkg Leaflet assets
 * referenced by public/index.html are served from client/node_modules.
 * Any other request leaving the app origin is aborted and recorded so the test fails.
 * Routes registered later take precedence, so the catch-all comes first.
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
  await page.route(`${STATIONS_API_BASE_URL}**`, fulfillStationsApi);
  await page.route('https://api.mapbox.com/**', route =>
    route.fulfill({ body: transparentPixelPng, contentType: 'image/png', headers: CORS_HEADERS })
  );
  await page.route('https://unpkg.com/leaflet*/dist/leaflet.css', route =>
    route.fulfill({
      body: readClientStylesheet('leaflet/dist/leaflet.css'),
      contentType: 'text/css',
    })
  );
  await page.route('https://unpkg.com/leaflet*/dist/images/**', fulfillLeafletImage);
  await page.route('https://unpkg.com/react-leaflet-markercluster/dist/styles.min.css', route =>
    route.fulfill({
      body: readClientStylesheet(
        'leaflet.markercluster/dist/MarkerCluster.css',
        'leaflet.markercluster/dist/MarkerCluster.Default.css'
      ),
      contentType: 'text/css',
    })
  );
};

export const test = base.extend({
  geolocation: kasselLocation,
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

/** Price text as rendered by the Price component: four characters plus a superscript digit. */
export const formatPrice = (price: number): string => price.toString().substring(0, 5);

/** Name shown in the station list: the brand, or the name truncated to 14 characters. */
export const listName = (station: GasStation): string => {
  if (station.brand !== null) {
    return station.brand;
  }
  if (station.name.length <= 14) {
    return station.name;
  }
  return `${station.name.substring(0, 14)}...`;
};

/** Station cards rendered by GasStationList inside the page's main landmark. */
export const stationListItems = (page: Page): Locator =>
  page.getByRole('main').getByRole('listitem');

export const stationListItem = (page: Page, station: GasStation): Locator =>
  stationListItems(page).filter({ hasText: station.address.street });

/**
 * The favorite star is a bare react-icons SVG with an onClick handler and no role or
 * accessible name, so it can only be reached structurally (accessibility bug in the app).
 * `:scope > div > svg` also skips the Leaflet attribution flag SVG on the detail page.
 */
export const favoriteStar = (container: Locator): Locator =>
  container.locator(':scope > div > svg');

export const storedFavoriteIds = (page: Page): Promise<unknown> =>
  page.evaluate((): unknown => JSON.parse(localStorage.getItem('favoriteIDs') ?? 'null'));

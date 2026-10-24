import { AxeBuilder } from '@axe-core/playwright';
import { test as base, expect } from '@playwright/test';
import type { BrowserContext, Locator, Page } from '@playwright/test';

/**
 * Stations of `data/france-stations.json` as the app shows them for a user at the centre of
 * Paris (`parisCenter`, the emulated own position). French open data has neither brand nor name,
 * so the street is the station title. Distances are computed by the API from the search center;
 * prices are the plain (screen reader) text of the Price component.
 *
 * The explore page starts at the Eiffel Tower, 3.4–6 km away from the fixture stations, so with
 * the default 5 km radius only Rue Bailleul is in range there. Tests that need every station call
 * `useOwnPosition` first.
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

/** Start center of every visit; the app never asks for the position on its own. */
export const eiffelTower = { latitude: 48.8584, longitude: 2.2945, label: 'Eiffelturm, Paris' };

const OWN_POSITION_LABEL = 'Dein Standort';

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
 * test fails. Routes registered later take precedence, so the catch-all comes first. Requests of
 * the API that the mock upstream does not know fail the run in `global-teardown.ts`.
 */
const mockExternalServices = async (
  target: Page | BrowserContext,
  applicationOrigin: string,
  unmockedRequests: string[]
): Promise<void> => {
  await target.route(
    url => url.origin !== applicationOrigin,
    async route => {
      unmockedRequests.push(`${route.request().method()} ${route.request().url()}`);
      await route.abort('blockedbyclient');
    }
  );
  await target.route(
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

/**
 * For the `pwa` project: the same mocks on the browser context. Requests of the service worker
 * (it fetches map tiles on behalf of the page) only pass through context routes in Chromium.
 */
export const serviceWorkerTest = base.extend({
  geolocation: parisCenter,
  permissions: ['geolocation'],
  context: async ({ context, baseURL }, use) => {
    if (!baseURL) {
      throw new Error('baseURL must be configured in playwright.config.ts');
    }
    const unmockedRequests: string[] = [];
    await mockExternalServices(context, new URL(baseURL).origin, unmockedRequests);
    await use(context);
    expect(unmockedRequests, 'every request outside the app origin must be mocked').toEqual([]);
  },
});

export { expect };

/**
 * For the `pwa` project: loads the app and waits until the service worker controls the page and
 * has cached the app shell (its debug page lists an installed version only after every prefetch
 * file is stored).
 */
export const installServiceWorker = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(resultSummary(page)).toContainText(eiffelTower.label);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  await expect
    .poll(() => page.evaluate(async () => (await fetch('/ngsw/state')).text()), {
      timeout: 30_000,
    })
    .toContain('=== Version ');
};

/** The level 1 heading that names the current page. */
export const pageHeading = (page: Page, name: string): Locator =>
  page.getByRole('heading', { level: 1, name });

/** The color scheme the app has resolved and applied to the document. */
export const expectColorScheme = async (page: Page, scheme: 'light' | 'dark'): Promise<void> => {
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', scheme);
};

/** The station list of the explore and favorites pages. */
export const stationList = (page: Page): Locator =>
  page.getByRole('main').getByRole('list', { name: 'Tankstellen', exact: true });

export const stationCards = (page: Page): Locator => stationList(page).getByRole('listitem');

export const stationCard = (page: Page, station: FixtureStation): Locator =>
  stationCards(page).filter({ has: page.getByText(station.title, { exact: true }) });

export const favoriteButton = (container: Locator, station: FixtureStation): Locator =>
  container.getByRole('button', { name: `Favorit: ${station.title}`, exact: true });

/**
 * On the explore page the title of a row is a button that shows the station on the map; the row of
 * the selected station is `aria-current`.
 */
export const stationRowButton = (container: Locator, station: FixtureStation): Locator =>
  container.getByRole('button', { name: station.title, exact: true });

export const stationsMap = (page: Page): Locator =>
  page.getByRole('region', { name: 'Karte der Tankstellen', exact: true });

/**
 * "N Tankstellen im Umkreis von R km um <label>" on the explore page. It is only filled once the
 * stations of the current search center have loaded, so its label proves the list is current.
 * An empty result reads "Keine Tankstellen mit Preis für <fuel> im Umkreis von R km gefunden."
 * instead, without the center.
 */
export const resultSummary = (page: Page): Locator =>
  page.getByRole('status').filter({ hasText: 'im Umkreis von' });

/** The list floats over the map as a sheet whose handle names the next step. */
export const sheetHandle = (page: Page): Locator =>
  page
    .getByRole('region', { name: 'Tankstellen', exact: true })
    .getByRole('button', { name: /^Liste (vergrößern|verkleinern)$/ });

/** The settings open as a modal dialog over the explore page. */
export const settingsDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Einstellungen', exact: true });

/** Title of the list of all favorites. */
export const favoritesHeading = (page: Page): Locator =>
  favoritesList(page).getByRole('heading', { level: 2, name: 'Favoriten', exact: true });

/** All favorites, shown in the explore sheet instead of the stations; it has a back button. */
export const favoritesList = (page: Page): Locator =>
  page
    .getByRole('region', { name: 'Favoriten', exact: true })
    .filter({ has: page.getByRole('button', { name: 'Zurück', exact: true }) });

/** The favorites row above the stations in the explore sheet; it links to all favorites. */
export const favoritesRow = (page: Page): Locator =>
  page
    .getByRole('region', { name: 'Favoriten', exact: true })
    .filter({ has: page.getByRole('link', { name: 'Alle Favoriten', exact: true }) });

/** A station's card, shown in the explore sheet instead of the stations. */
export const openedStationCard = (page: Page): Locator =>
  page.getByRole('region', { name: 'Tankstelle', exact: true });

/** The round settings button in the header of the explore sheet. */
export const settingsButton = (page: Page): Locator =>
  page.getByRole('region', { name: 'Tankstellen', exact: true }).getByRole('link', {
    name: 'Einstellungen',
    exact: true,
  });

/**
 * Returns to the list of the explore page the way a user does, keeping the app state of the
 * current visit: closes the settings dialog, the favorites or a station's card, or follows the
 * link of the 404 page. There is no navigation bar; the sheet is the app.
 *
 * The URL decides what is open, not a visibility check: right after `page.goto` the lazy route
 * may not have rendered yet, and `isVisible()` does not wait for it. The clicks below do.
 */
export const openExplore = async (page: Page): Promise<void> => {
  const pathname = new URL(page.url()).pathname;
  if (pathname === '/settings') {
    const dialog = settingsDialog(page);
    await dialog.getByRole('button', { name: 'Schließen', exact: true }).click();
    await expect(dialog).toBeHidden();
  } else if (pathname === '/favorites') {
    await favoritesList(page).getByRole('button', { name: 'Zurück', exact: true }).click();
  } else if (pathname.startsWith('/stations/')) {
    await openedStationCard(page).getByRole('button', { name: 'Schließen', exact: true }).click();
  } else if (pathname !== '/') {
    await page.getByRole('link', { name: 'Zur Karte', exact: true }).click();
  }
  await expect(page).toHaveURL('/');
  await expect(pageHeading(page, 'GenialTanken')).toBeVisible();
};

/** Opens the list of all favorites through "Alle" of the favorites row; needs a favorite. */
export const openFavorites = async (page: Page): Promise<void> => {
  if (!(await favoritesRow(page).isVisible())) {
    await openExplore(page);
  }
  await favoritesRow(page).getByRole('link', { name: 'Alle Favoriten', exact: true }).click();
  await expect(favoritesHeading(page)).toBeVisible();
};

/**
 * Centers the explore page on the emulated own position (`parisCenter`), where every fixture
 * station is in range, and waits until the stations around it have loaded.
 */
export const useOwnPosition = async (
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> => {
  await page.getByRole('button', { name: 'Meinen Standort verwenden' }).click();
  await expect(resultSummary(page)).toContainText(`um ${OWN_POSITION_LABEL}`, options);
};

/**
 * Opens the settings dialog through the round button of the sheet header. The router attaches
 * the page before its first change detection binds the form, so the test waits for the bound
 * radius label (its first binding) before interacting; otherwise the input is ignored (Angular
 * error NG0950).
 */
export const openSettings = async (page: Page): Promise<void> => {
  if (!(await settingsButton(page).isVisible())) {
    await openExplore(page);
  }
  await settingsButton(page).click();
  await expect(
    settingsDialog(page).getByRole('slider', { name: /^Radius: \d+ km$/ })
  ).toBeVisible();
};

export const fuelOptions = (page: Page): Locator =>
  page.getByRole('group', { name: 'Kraftstoff', exact: true });

export const colorSchemeOptions = (page: Page): Locator =>
  page.getByRole('group', { name: 'Darstellung', exact: true });

/**
 * Chooses an option of a settings group as a pointer user does: the native radio is visually
 * hidden (it stays for assistive technology), the whole row is its face.
 */
export const chooseSettingsOption = async (group: Locator, label: string): Promise<void> => {
  await group.getByText(label, { exact: true }).click();
  await expect(group.getByRole('radio', { name: label, exact: true })).toBeChecked();
};

/** Selects a fuel type on the settings page, which applies it immediately. */
export const chooseFuel = async (page: Page, fuel: FuelOptionLabel): Promise<void> => {
  await openSettings(page);
  await chooseSettingsOption(fuelOptions(page), fuel);
};

const FAVORITE_IDENTIFIERS_STORAGE_KEY = 'favoriteIDs';

/** Stores favorites before every page load of the test, as an earlier visit would have. */
export const seedFavorites = async (page: Page, identifiers: string[]): Promise<void> => {
  await page.addInitScript(
    ({ storageKey, favoriteIdentifiers }) => {
      localStorage.setItem(storageKey, JSON.stringify(favoriteIdentifiers));
    },
    { storageKey: FAVORITE_IDENTIFIERS_STORAGE_KEY, favoriteIdentifiers: identifiers }
  );
};

export const storedFavoriteIdentifiers = (page: Page): Promise<unknown> =>
  page.evaluate(
    (storageKey): unknown => JSON.parse(localStorage.getItem(storageKey) ?? 'null'),
    FAVORITE_IDENTIFIERS_STORAGE_KEY
  );

/** The card in the explore sheet that suggests adding the app to the home screen. */
export const installationHint = (page: Page): Locator =>
  page.getByRole('region', { name: 'GenialTanken als App', exact: true });

/**
 * Makes the browser look like Safari on iOS, which adds web apps to the home screen through its
 * Share menu and alone knows `navigator.standalone`. On a touch device (the `mobile` project) the
 * explore sheet then suggests those steps; Chromium never shows the hint on its own in tests.
 */
export const suggestHomeScreenSteps = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'standalone', {
      configurable: true,
      get: () => false,
    });
  });
};

// `wcag2aaa` adds the enhanced contrast rule (1.4.6).
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Scans the page in its current state with axe for violations of WCAG 2.2 up to AAA. */
export const expectNoAccessibilityViolations = async (page: Page): Promise<void> => {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  expect(
    results.violations.map(violation => ({
      rule: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map(node => node.target.join(' ')),
    }))
  ).toEqual([]);
};

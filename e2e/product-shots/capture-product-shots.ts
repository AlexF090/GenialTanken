/**
 * Captures the product images in `docs/images/` from the live app.
 *
 *   node e2e/product-shots/capture-product-shots.ts                 # capture and compose
 *   node e2e/product-shots/capture-product-shots.ts --compose-only  # compose the last capture again
 *   node e2e/product-shots/capture-product-shots.ts --only=mobile-dark  # capture one scene again
 *
 * Runs with plain Node (type stripping) and the Playwright of the e2e workspace; it is no test, so
 * neither `e2e/playwright.config.ts` nor CI picks it up. It drives the production app, because
 * only there the Mapbox map works and the prices are real: a few page loads per run, nothing more.
 * Raw screenshots go to the temporary directory; only the composed images are kept.
 *
 * The container's `system-ui` is a wide fallback font, so the script loads Roboto (what `system-ui`
 * is on Android, also part of the app's font stack) from Google Fonts and puts it first.
 */
import { mkdir, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, devices, expect } from '@playwright/test';
import type { Browser, BrowserContextOptions, Locator, Page } from '@playwright/test';

const APPLICATION_URL = 'https://genialtanken.alexf090.workers.dev/';
const PARIS_CENTER = { latitude: 48.8566, longitude: 2.3522 };
const FUEL_LABEL = 'Diesel';
const ROBOTO_STYLESHEET_URL =
  'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=block';

const rawShotsDirectory = join(tmpdir(), 'genialtanken-product-shots');
const imagesDirectory = fileURLToPath(new URL('../../docs/images/', import.meta.url));
const compositionUrl = pathToFileURL(fileURLToPath(new URL('composition.html', import.meta.url)));

const RAW_SHOT_NAMES = ['desktop', 'mobile-explore', 'mobile-station', 'mobile-dark'] as const;
type RawShotName = (typeof RAW_SHOT_NAMES)[number];

const COMPOSITIONS = ['desktop', 'mobile', 'hero'] as const;
type Composition = (typeof COMPOSITIONS)[number];

const sharedContextOptions: BrowserContextOptions = {
  locale: 'de-DE',
  timezoneId: 'Europe/Paris',
  geolocation: PARIS_CENTER,
  permissions: ['geolocation'],
  reducedMotion: 'reduce',
};

const desktopContextOptions: BrowserContextOptions = {
  ...sharedContextOptions,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
};

const phoneContextOptions = (colorScheme: 'light' | 'dark'): BrowserContextOptions => ({
  ...devices['iPhone 13'],
  ...sharedContextOptions,
  // The full screen of the phone, not the part a browser leaves for the page
  viewport: { width: 390, height: 844 },
  colorScheme,
});

const rawShotPath = (name: RawShotName): string => join(rawShotsDirectory, `${name}.png`);

/** Adds Roboto to the app's document before Angular renders, so no measurement sees a font swap. */
const serveRoboto = async (page: Page): Promise<void> => {
  await page.route(
    url => url.origin === new URL(APPLICATION_URL).origin && !url.pathname.includes('.'),
    async route => {
      if (route.request().resourceType() !== 'document') {
        await route.fallback();
        return;
      }
      const response = await route.fetch();
      const html = await response.text();
      const fontStyles = `<link rel="stylesheet" href="${ROBOTO_STYLESHEET_URL}"><style>:root { --font-family-ui: Roboto, sans-serif; }</style>`;
      await route.fulfill({ response, body: html.replace('</head>', `${fontStyles}</head>`) });
    }
  );
};

const resultSummary = (page: Page) =>
  page.getByRole('status').filter({ hasText: 'im Umkreis von' });

const stationsMap = (page: Page) =>
  page.getByRole('region', { name: 'Karte der Tankstellen', exact: true });

const stationRows = (page: Page) =>
  page
    .getByRole('main')
    .getByRole('list', { name: 'Tankstellen', exact: true })
    .getByRole('listitem');

/** Waits until every map tile is loaded, the price tags are drawn and the network is quiet. */
const waitUntilSettled = async (page: Page): Promise<void> => {
  await expect(stationsMap(page).getByRole('button', { name: /€/ }).first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => {
    const tiles = [...document.querySelectorAll<HTMLImageElement>('img.leaflet-tile')];
    return tiles.length > 0 && tiles.every(tile => tile.complete && tile.naturalWidth > 0);
  });
  await page.evaluate(() => document.fonts.ready);
  // Leaflet fades tiles in and the sheet settles after measuring; let both finish.
  await page.waitForTimeout(1500);
};

const openAtOwnPosition = async (page: Page): Promise<void> => {
  await serveRoboto(page);
  await page.goto(APPLICATION_URL);
  await page.getByRole('button', { name: 'Meinen Standort verwenden' }).click();
  await expect(resultSummary(page)).toContainText('um Dein Standort', { timeout: 30_000 });
  await page.getByRole('button', { name: /^Kraftstoff/ }).click();
  await page.getByRole('menuitemradio', { name: FUEL_LABEL, exact: true }).click();
  await expect(stationRows(page).first()).toBeVisible({ timeout: 30_000 });
  await waitUntilSettled(page);
};

/** Selects a station as a user who taps its row, so the map zooms in and centers its price tag. */
const selectStation = async (page: Page, row: Locator): Promise<void> => {
  await row.getByRole('button').first().click();
  await waitUntilSettled(page);
};

const cheapestRow = (page: Page): Locator =>
  stationRows(page).filter({ hasText: 'Günstigster Preis' }).first();

const sortByPrice = async (page: Page): Promise<void> => {
  await page.getByText('Preis', { exact: true }).click();
  await waitUntilSettled(page);
};

/** Opens the station card of a row and pulls the sheet up, so the card shows its prices. */
const openStationCard = async (page: Page, row: Locator): Promise<void> => {
  await row.getByRole('link', { name: /^Details: / }).click();
  await expect(page.getByRole('region', { name: 'Tankstelle', exact: true })).toBeVisible();
  await page
    .getByRole('region', { name: 'Tankstellen', exact: true })
    .getByRole('button', { name: 'Liste vergrößern', exact: true })
    .click();
  await waitUntilSettled(page);
};

interface Scene {
  contextOptions: BrowserContextOptions;
  arrange: (page: Page) => Promise<void>;
}

const SCENES: Record<RawShotName, Scene> = {
  desktop: {
    contextOptions: desktopContextOptions,
    arrange: page => selectStation(page, cheapestRow(page)),
  },
  // The sheet opens at half height, which shows map and list together.
  'mobile-explore': {
    contextOptions: phoneContextOptions('light'),
    arrange: async page => {
      await sortByPrice(page);
      await selectStation(page, cheapestRow(page));
    },
  },
  'mobile-station': {
    contextOptions: phoneContextOptions('light'),
    arrange: page => openStationCard(page, stationRows(page).nth(1)),
  },
  'mobile-dark': {
    contextOptions: phoneContextOptions('dark'),
    arrange: page => selectStation(page, stationRows(page).first()),
  },
};

const captureRawShot = async (browser: Browser, name: RawShotName): Promise<void> => {
  const { contextOptions, arrange } = SCENES[name];
  const context = await browser.newContext(contextOptions);
  try {
    const page = await context.newPage();
    await openAtOwnPosition(page);
    await arrange(page);
    await page.screenshot({ path: rawShotPath(name) });
    console.info(`Captured ${rawShotPath(name)}`);
  } finally {
    await context.close();
  }
};

/** `--only=desktop,mobile-dark` captures just these again; `--compose-only` captures none. */
const rawShotsToCapture = (): readonly RawShotName[] => {
  if (process.argv.includes('--compose-only')) {
    return [];
  }
  const onlyArgument = process.argv.find(argument => argument.startsWith('--only='));
  if (onlyArgument === undefined) {
    return RAW_SHOT_NAMES;
  }
  const requested = onlyArgument.slice('--only='.length).split(',');
  return RAW_SHOT_NAMES.filter(name => requested.includes(name));
};

const toDataUrl = async (name: RawShotName): Promise<string> => {
  const image = await readFile(rawShotPath(name));
  return `data:image/png;base64,${image.toString('base64')}`;
};

const compose = async (browser: Browser, composition: Composition): Promise<void> => {
  const shots = Object.fromEntries(
    await Promise.all(RAW_SHOT_NAMES.map(async name => [name, await toDataUrl(name)] as const))
  );
  const page = await browser.newPage({ viewport: { width: 2400, height: 1600 } });
  try {
    await page.goto(`${compositionUrl.href}?composition=${composition}`);
    await page.evaluate(async sources => {
      const images = [...document.querySelectorAll<HTMLImageElement>('img[data-shot]')];
      for (const image of images) {
        image.src = sources[image.dataset.shot ?? ''] ?? '';
      }
      await Promise.all(images.map(image => image.decode()));
      await document.fonts.ready;
    }, shots);
    const path = join(imagesDirectory, `product-${composition}.jpg`);
    // Map tiles compress badly as PNG; JPEG keeps each image well below 600 KB.
    await page.locator(`.stage--${composition}`).screenshot({ path, type: 'jpeg', quality: 92 });
    const { size } = await stat(path);
    console.info(`Composed ${path} (${String(Math.round(size / 1024))} KB)`);
  } finally {
    await page.close();
  }
};

const browser = await chromium.launch();
try {
  await mkdir(rawShotsDirectory, { recursive: true });
  for (const name of rawShotsToCapture()) {
    await captureRawShot(browser, name);
  }
  await mkdir(imagesDirectory, { recursive: true });
  for (const composition of COMPOSITIONS) {
    await compose(browser, composition);
  }
} finally {
  await browser.close();
}

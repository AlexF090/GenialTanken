import { createHash } from 'node:crypto';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { z } from 'zod';
import {
  expect,
  installServiceWorker,
  pageHeading,
  serviceWorkerTest as test,
  settingsButton,
} from '../../fixtures.ts';

/** The service worker registers once the app is stable, at the latest after 30 seconds. */
test.describe.configure({ timeout: 90_000 });

/**
 * The service worker checks for a new version once it has been idle for a few seconds after a
 * navigation, at the latest after 30 seconds.
 */
const UPDATE_CHECK_TIMEOUT_IN_MILLISECONDS = 45_000;

const serviceWorkerManifestSchema = z.looseObject({
  hashTable: z.record(z.string(), z.string()),
});

const isPath =
  (path: string) =>
  (url: URL): boolean =>
    url.pathname === path;

const sha1Of = (content: string): string => createHash('sha1').update(content).digest('hex');

const updateNotice = (page: Page): Locator =>
  page.getByRole('status').filter({ hasText: 'Neue Version verfügbar' });

/**
 * Deploys a new version as far as the service worker can tell: a changed `index.html` and an
 * `ngsw.json` with its hash. The service worker fetches both through the context routes.
 */
const deployNewVersion = async (context: BrowserContext): Promise<void> => {
  const changeIndex = (index: string): string => `${index}<!-- e2e: new version -->`;
  await context.route(isPath('/index.html'), async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: changeIndex(await response.text()) });
  });
  await context.route(isPath('/ngsw.json'), async route => {
    const response = await route.fetch();
    const manifest = serviceWorkerManifestSchema.parse(await response.json());
    const indexResponse = await route.fetch({
      url: new URL('/index.html', route.request().url()).href,
    });
    manifest.hashTable['/index.html'] = sha1Of(changeIndex(await indexResponse.text()));
    await route.fulfill({ response, json: manifest });
  });
};

/** Scripts of the installed version that the page has not loaded yet, e.g. lazy routes. */
const scriptsNotLoadedYet = async (page: Page): Promise<string[]> => {
  const manifest = serviceWorkerManifestSchema.parse(
    await (await page.request.get('/ngsw.json')).json()
  );
  const loadedPaths = await page.evaluate(() =>
    performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname)
  );
  return Object.keys(manifest.hashTable).filter(
    path => path.endsWith('.js') && !loadedPaths.includes(path)
  );
};

/** Removes files from the service worker's cache of the app shell, as an evicted cache does. */
const removeFromServiceWorkerCache = (page: Page, paths: string[]): Promise<void> =>
  page.evaluate(async removedPaths => {
    for (const cacheName of await caches.keys()) {
      if (!cacheName.endsWith(':assets:app:cache')) {
        continue;
      }
      const cache = await caches.open(cacheName);
      for (const request of await cache.keys()) {
        if (removedPaths.includes(new URL(request.url).pathname)) {
          await cache.delete(request);
        }
      }
    }
  }, paths);

test('a new version is offered with "Neu laden" and loads on request', async ({
  page,
  context,
}) => {
  await installServiceWorker(page);
  await expect(updateNotice(page)).toHaveCount(0);

  await deployNewVersion(context);
  await page.reload();

  const notice = updateNotice(page);
  await expect(notice).toBeVisible({ timeout: UPDATE_CHECK_TIMEOUT_IN_MILLISECONDS });
  const reloaded = page.waitForEvent('load');
  await notice.getByRole('button', { name: 'Neu laden', exact: true }).click();
  await reloaded;

  await expect(pageHeading(page, 'GenialTanken')).toBeVisible();
  await expect(updateNotice(page)).toHaveCount(0);
});

test('a version whose files are gone from cache and server reloads the app on its own', async ({
  page,
  context,
}) => {
  await installServiceWorker(page);
  const lazyScripts = await scriptsNotLoadedYet(page);
  expect(lazyScripts.length).toBeGreaterThan(0);
  // A later deploy removed the files of this version, and the browser evicted them.
  await context.route(
    url => lazyScripts.includes(url.pathname),
    route => route.fulfill({ status: 404 })
  );
  await removeFromServiceWorkerCache(page, lazyScripts);

  const reloaded = page.waitForEvent('load');
  await settingsButton(page).click();
  await reloaded;

  await expect(pageHeading(page, 'GenialTanken')).toBeVisible();
  await expect(page.getByText('Die App muss neu geladen werden.')).toHaveCount(0);
});

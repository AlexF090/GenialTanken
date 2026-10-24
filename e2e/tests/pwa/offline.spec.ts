import {
  eiffelTower,
  expect,
  installServiceWorker,
  pageHeading,
  resultSummary,
  serviceWorkerTest as test,
} from '../../fixtures.ts';

const OFFLINE_MESSAGE = 'Du bist offline – Preise werden geladen, sobald du wieder verbunden bist.';

/** The service worker registers once the app is stable, at the latest after 30 seconds. */
test.describe.configure({ timeout: 90_000 });

const isStationsRequest = (url: string): boolean => new URL(url).pathname === '/api/stations';

test('the service worker takes control after the first visit', async ({ page }) => {
  await installServiceWorker(page);

  await expect(pageHeading(page, 'GenialTanken')).toBeVisible();
});

test('API requests go to the network, never through the service worker', async ({ page }) => {
  await installServiceWorker(page);

  const stationsResponse = page.waitForResponse(response => isStationsRequest(response.url()));
  await page.reload();

  expect((await stationsResponse).fromServiceWorker()).toBe(false);
  await expect(resultSummary(page)).toContainText(eiffelTower.label);
});

test('offline, a reload shows the app shell and explains the missing prices', async ({
  page,
  context,
}) => {
  await installServiceWorker(page);

  await context.setOffline(true);
  const stationsFailure = page.waitForEvent('requestfailed', request =>
    isStationsRequest(request.url())
  );
  const navigation = await page.reload();

  expect(navigation?.fromServiceWorker()).toBe(true);
  await expect(pageHeading(page, 'GenialTanken')).toBeVisible();
  await stationsFailure;
  await expect(page.getByRole('status').filter({ hasText: OFFLINE_MESSAGE })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);

  await context.setOffline(false);

  await expect(resultSummary(page)).toContainText(eiffelTower.label);
  await expect(page.getByText(OFFLINE_MESSAGE)).toHaveCount(0);
});

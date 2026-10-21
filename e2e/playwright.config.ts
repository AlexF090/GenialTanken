import { fileURLToPath } from 'node:url';
import { MOCK_UPSTREAM_PORT } from './mock-upstream-endpoints.js';
import { defineConfig, devices } from '@playwright/test';

/**
 * Not the development ports (API 3000, web 4200): `reuseExistingServer` would otherwise pick up a
 * running `pnpm dev`, which talks to the real upstreams, and the suite would test real data.
 */
const API_PORT = 3100;
const WEB_PORT = 4300;

const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${String(WEB_PORT)}`;
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const isContinuousIntegration = Boolean(process.env.CI);
/** Only exists in compact viewports, so it runs on a phone only. */
const MOBILE_ONLY_TESTS = '**/bottom-sheet.spec.ts';
/** The phone project runs these too; the desktop project covers every other spec. */
const MOBILE_TESTS = [MOBILE_ONLY_TESTS, '**/accessibility.spec.ts'];

/** `ng serve` and `nest start` compile on a cold start, which can take a while. */
const SERVER_START_TIMEOUT_IN_MILLISECONDS = 240_000;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isContinuousIntegration,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  // Runs before the web servers stop, so it can still ask the mock upstream.
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: MOBILE_ONLY_TESTS,
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: MOBILE_TESTS },
  ],
  webServer: [
    {
      name: 'Mock upstream (French fuel price API)',
      command: 'node e2e/mock-upstream.ts',
      cwd: repositoryRoot,
      port: MOCK_UPSTREAM_PORT,
      env: { E2E_MOCK_UPSTREAM_PORT: String(MOCK_UPSTREAM_PORT) },
      reuseExistingServer: !isContinuousIntegration,
      timeout: 10_000,
    },
    {
      name: 'API',
      command: 'pnpm --filter api start',
      cwd: repositoryRoot,
      url: `http://localhost:${String(API_PORT)}/health`,
      // Only the French provider exists; it is mocked.
      env: {
        FRANCE_FUEL_PRICES_BASE_URL: `http://localhost:${String(MOCK_UPSTREAM_PORT)}`,
        FRANCE_STATION_DETAILS_BASE_URL: `http://localhost:${String(MOCK_UPSTREAM_PORT)}`,
        PHOTON_BASE_URL: `http://localhost:${String(MOCK_UPSTREAM_PORT)}`,
        PORT: String(API_PORT),
        WEB_ORIGIN: baseURL,
        RATE_LIMIT_REQUESTS_PER_MINUTE: '10000',
      },
      reuseExistingServer: !isContinuousIntegration,
      timeout: SERVER_START_TIMEOUT_IN_MILLISECONDS,
    },
    {
      name: 'Web',
      // Without a Mapbox token the maps use OpenStreetMap tiles, which the fixtures mock.
      // The proxy configuration path is relative to apps/web, where `pnpm --filter web exec` runs.
      command: `pnpm --filter web exec ng serve --port ${String(WEB_PORT)} --proxy-config ../../e2e/web-proxy.conf.json`,
      cwd: repositoryRoot,
      url: baseURL,
      reuseExistingServer: !isContinuousIntegration,
      timeout: SERVER_START_TIMEOUT_IN_MILLISECONDS,
    },
  ],
});

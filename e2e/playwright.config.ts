import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const webServerCommand = process.env.E2E_WEB_SERVER_COMMAND ?? 'pnpm --filter client start';
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: webServerCommand,
    cwd: repositoryRoot,
    url: baseURL,
    env: { BROWSER: 'none' },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

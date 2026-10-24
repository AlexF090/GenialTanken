import type { Page } from '@playwright/test';
import {
  eiffelTower,
  expect,
  resultSummary,
  serviceWorkerTest as test,
  sheetHandle,
} from '../../fixtures.ts';

/** The window of an iPhone 16 Pro installed app, minus the status bar. */
const INSTALLED_WINDOW = { width: 402, height: 812 };

test.use({ viewport: INSTALLED_WINDOW, screen: INSTALLED_WINDOW, colorScheme: 'light' });

const STANDALONE_MEDIA_QUERY = /\(\s*display-mode\s*:\s*standalone\s*\)/g;

/**
 * Chromium cannot emulate `display-mode`: `Emulation.setEmulatedMedia` ignores the feature and
 * `Emulation.setDisplayModeOverride` does not exist (checked with Playwright 1.64). So the
 * stylesheets are served with the standalone media query replaced by an always true one. This keeps what the
 * test is about, the position of the rule in the cascade and the resulting layout; it does not
 * check the media query itself.
 */
const treatAsInstalledApp = async (page: Page): Promise<() => number> => {
  let rewrittenQueries = 0;
  await page.context().route(
    request => request.pathname !== '/ngsw.json',
    async route => {
      const resourceType = route.request().resourceType();
      if (resourceType !== 'stylesheet' && resourceType !== 'document') {
        return route.fallback();
      }
      const response = await route.fetch();
      const body = (await response.text()).replace(STANDALONE_MEDIA_QUERY, () => {
        rewrittenQueries += 1;
        return '(min-width: 0px)';
      });
      await route.fulfill({ response, body });
    }
  );
  return () => rewrittenQueries;
};

const openApp = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(resultSummary(page)).toContainText(eiffelTower.label);
};

const rootMinimumHeight = (page: Page): Promise<string> =>
  page.evaluate(() => getComputedStyle(document.documentElement).minHeight);

const bodyMinimumHeight = (page: Page): Promise<string> =>
  page.evaluate(() => getComputedStyle(document.body).minHeight);

/** The layout box without transforms: the sheet slides down by its hidden part (`transform`). */
const layoutBottomEdgeOf = (page: Page, selector: string): Promise<number> =>
  page.evaluate(selector => {
    const element = document.querySelector(selector);
    if (!(element instanceof HTMLElement)) {
      throw new Error(`No element matches ${selector}`);
    }
    return element.offsetTop + element.offsetHeight;
  }, selector);

/**
 * Limit: `env(safe-area-inset-top)` and the short iOS web view cannot be emulated, so the test
 * covers the cascade of the rule and a window that already is as tall as the screen, not the
 * 812 versus 874 pixel situation of a real device.
 */
test.describe('installed app (display-mode: standalone)', () => {
  test('the built stylesheet contains the standalone rule', async ({ page }) => {
    const rewrittenQueries = await treatAsInstalledApp(page);
    await openApp(page);

    expect(rewrittenQueries()).toBeGreaterThan(0);
  });

  test('the standalone rule wins over the base rule of the root element', async ({ page }) => {
    await treatAsInstalledApp(page);
    await openApp(page);

    const rootHeight = await rootMinimumHeight(page);
    expect(rootHeight).not.toBe('100%');
    expect(rootHeight).toContain('min(');
    expect(await bodyMinimumHeight(page)).toBe('100%');
  });

  test('a browser tab keeps the base rule', async ({ page }) => {
    await openApp(page);

    expect(await page.evaluate(() => matchMedia('(display-mode: standalone)').matches)).toBe(false);
    expect(await rootMinimumHeight(page)).toBe('100%');
    expect(await bodyMinimumHeight(page)).toBe('100%');
  });

  test('the page and the sheet fill the window without scrolling', async ({ page }) => {
    await treatAsInstalledApp(page);
    await openApp(page);
    const windowHeight = await page.evaluate(() => innerHeight);

    const expectFilledWindow = async (): Promise<void> => {
      expect(await layoutBottomEdgeOf(page, 'app-explore-page')).toBeCloseTo(windowHeight, 0);
      expect(await layoutBottomEdgeOf(page, '.bottom-sheet')).toBeCloseTo(windowHeight, 0);
      const metrics = await page.evaluate(() => ({
        rootHeight: document.documentElement.getBoundingClientRect().height,
        scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
        scrollY,
      }));
      expect(metrics.rootHeight).toBeGreaterThanOrEqual(windowHeight);
      expect(metrics.scrollHeight).toBeLessThanOrEqual(windowHeight);
      expect(metrics.scrollY).toBe(0);
    };

    // The sheet starts at half; one press goes to full, two more to peek.
    await expect(sheetHandle(page)).toHaveAccessibleName('Liste vergrößern');
    await sheetHandle(page).click();
    await expect(sheetHandle(page)).toHaveAccessibleName('Liste verkleinern');
    await expectFilledWindow();

    await sheetHandle(page).click();
    await sheetHandle(page).click();
    await expect(sheetHandle(page)).toHaveAccessibleName('Liste vergrößern');
    await expect(sheetHandle(page)).toHaveAttribute('aria-expanded', 'false');
    await expectFilledWindow();
  });

  test('no gap is measured when the window is as tall as the screen', async ({ page }) => {
    await treatAsInstalledApp(page);
    await openApp(page);

    const { windowHeight, screenHeight, gap } = await page.evaluate(() => ({
      windowHeight: innerHeight,
      screenHeight: screen.height,
      gap: getComputedStyle(document.documentElement)
        .getPropertyValue('--layout-viewport-gap-bottom')
        .trim(),
    }));
    expect(windowHeight).toBe(screenHeight);
    expect(gap).toBe('0px');
  });
});

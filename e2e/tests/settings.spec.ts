import type { Page } from '@playwright/test';
import {
  chooseFuel,
  colorSchemeOptions,
  expect,
  FUEL_OPTION_LABELS,
  fuelOptions,
  openExplore,
  openSettings,
  resultSummary,
  rueBailleulStation,
  stationCard,
  stationCards,
  test,
  useOwnPosition,
} from '../fixtures.js';

const COLOR_SCHEME_LABELS = ['System', 'Hell', 'Dunkel'] as const;

type ColorSchemeLabel = (typeof COLOR_SCHEME_LABELS)[number];

const colorSchemeRadio = (page: Page, label: ColorSchemeLabel) =>
  colorSchemeOptions(page).getByRole('radio', { name: label, exact: true });

const storedColorScheme = (page: Page): Promise<unknown> =>
  page.evaluate((): unknown => {
    const settings: unknown = JSON.parse(localStorage.getItem('genialtanken.settings') ?? 'null');
    return typeof settings === 'object' && settings !== null
      ? Reflect.get(settings, 'colorScheme')
      : undefined;
  });

test.describe('settings', () => {
  test('offers every option with E5, 5 km and the system color scheme by default', async ({
    page,
  }) => {
    await page.goto('/settings');

    await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
    await expect(fuelOptions(page).getByRole('radio')).toHaveCount(FUEL_OPTION_LABELS.length);
    for (const fuel of FUEL_OPTION_LABELS) {
      const radio = fuelOptions(page).getByRole('radio', { name: fuel, exact: true });
      await (fuel === 'E5' ? expect(radio).toBeChecked() : expect(radio).not.toBeChecked());
    }

    const radiusSlider = page.getByRole('slider', { name: 'Radius: 5 km' });
    await expect(radiusSlider).toHaveValue('5');
    await expect(radiusSlider).toHaveAttribute('min', '1');
    await expect(radiusSlider).toHaveAttribute('max', '30');

    await expect(colorSchemeOptions(page).getByRole('radio')).toHaveCount(
      COLOR_SCHEME_LABELS.length
    );
    for (const label of COLOR_SCHEME_LABELS) {
      const radio = colorSchemeRadio(page, label);
      await (label === 'System' ? expect(radio).toBeChecked() : expect(radio).not.toBeChecked());
    }

    await expect(page.getByRole('heading', { level: 2, name: 'Datenquelle' })).toBeVisible();
    // Changes apply immediately, so there is nothing to submit.
    await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
  });

  test('changes apply immediately and survive a reload', async ({ page }) => {
    await page.goto('/settings');

    await fuelOptions(page).getByRole('radio', { name: 'E10', exact: true }).check();
    await page.getByRole('slider').fill('12');
    await expect(page.getByRole('slider', { name: 'Radius: 12 km' })).toHaveValue('12');

    await page.reload();

    await expect(fuelOptions(page).getByRole('radio', { name: 'E10', exact: true })).toBeChecked();
    await expect(page.getByRole('slider', { name: 'Radius: 12 km' })).toHaveValue('12');

    await openExplore(page);
    await expect(page.getByRole('button', { name: 'Kraftstoff: E10', exact: true })).toBeVisible();
    await expect(resultSummary(page)).toContainText('im Umkreis von 12 km');
  });

  test('changing the radius refetches the stations within the new radius', async ({ page }) => {
    await page.goto('/');
    await chooseFuel(page, 'Diesel');
    await openExplore(page);
    await useOwnPosition(page);
    await expect(stationCards(page)).toHaveCount(4);

    await openSettings(page);
    await page.getByRole('slider').fill('1');
    await expect(page.getByRole('slider', { name: 'Radius: 1 km' })).toHaveValue('1');
    await openExplore(page);

    await expect(resultSummary(page)).toHaveText(
      '1 Tankstelle im Umkreis von 1 km um Dein Standort'
    );
    await expect(stationCards(page)).toHaveCount(1);
    await expect(stationCard(page, rueBailleulStation)).toContainText(rueBailleulStation.distance);

    await chooseFuel(page, 'E10');
    await openExplore(page);

    await expect(
      page.getByText('Keine Tankstellen mit Preis für E10 im Umkreis von 1 km gefunden.')
    ).toBeVisible();
    await expect(stationCards(page)).toHaveCount(0);
  });

  test('the color scheme applies immediately and survives a reload', async ({ page }) => {
    await page.goto('/settings');
    // Playwright emulates a light operating system unless a test asks for dark.
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');

    await colorSchemeRadio(page, 'Dunkel').check();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
    await expect.poll(() => storedColorScheme(page)).toBe('dark');

    await page.reload();
    await expect(colorSchemeRadio(page, 'Dunkel')).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');

    await colorSchemeRadio(page, 'Hell').check();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
    await expect.poll(() => storedColorScheme(page)).toBe('light');

    await colorSchemeRadio(page, 'System').check();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
    await expect.poll(() => storedColorScheme(page)).toBe('system');
  });

  test('the stored color scheme tints the browser UI before the app starts', async ({ page }) => {
    // Without the application bundle only the inline script of index.html runs.
    await page.route(/\/main(-[A-Z0-9]+)?\.js$/, route => route.abort());
    await page.addInitScript(() => {
      localStorage.setItem(
        'genialtanken.settings',
        JSON.stringify({ fuelType: 'e5', radiusInKilometers: 5, colorScheme: 'dark' })
      );
    });
    await page.goto('/settings');

    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
    // Browsers use the first theme color whose media query matches.
    const appliedThemeColor = await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].find(
          meta => window.matchMedia(meta.media).matches
        )?.content
    );
    expect(appliedThemeColor).toBe('#06171d');
  });

  test.describe('on a dark operating system', () => {
    test.use({ colorScheme: 'dark' });

    test('"System" follows the operating system and "Hell" overrides it', async ({ page }) => {
      await page.goto('/settings');

      await expect(colorSchemeRadio(page, 'System')).toBeChecked();
      await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');

      await colorSchemeRadio(page, 'Hell').check();
      await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');

      await page.reload();
      await expect(colorSchemeRadio(page, 'Hell')).toBeChecked();
      await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
    });
  });
});

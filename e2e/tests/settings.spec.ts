import type { Page } from '@playwright/test';
import {
  chooseFuel,
  chooseSettingsOption,
  colorSchemeOptions,
  expect,
  expectColorScheme,
  FUEL_OPTION_LABELS,
  fuelOptions,
  openExplore,
  openSettings,
  pageHeading,
  resultSummary,
  settingsDialog,
  stationsMap,
  rueBailleulStation,
  stationCard,
  stationCards,
  test,
  useOwnPosition,
} from '../fixtures.ts';

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

    await expect(settingsDialog(page)).toBeVisible();
    await expect(fuelOptions(page).getByRole('radio')).toHaveCount(FUEL_OPTION_LABELS.length);
    for (const fuel of FUEL_OPTION_LABELS) {
      await expect(fuelOptions(page).getByRole('radio', { name: fuel, exact: true })).toBeChecked({
        checked: fuel === 'E5',
      });
    }

    const radiusSlider = page.getByRole('slider', { name: 'Radius: 5 km' });
    await expect(radiusSlider).toHaveValue('5');
    await expect(radiusSlider).toHaveAttribute('min', '1');
    await expect(radiusSlider).toHaveAttribute('max', '30');

    await expect(colorSchemeOptions(page).getByRole('radio')).toHaveCount(
      COLOR_SCHEME_LABELS.length
    );
    for (const label of COLOR_SCHEME_LABELS) {
      await expect(colorSchemeRadio(page, label)).toBeChecked({ checked: label === 'System' });
    }

    await expect(page.getByRole('heading', { level: 2, name: 'Datenquelle' })).toBeVisible();
    // Changes apply immediately, so there is nothing to submit; the only button closes.
    await expect(settingsDialog(page).getByRole('button')).toHaveAccessibleName('Schließen');
  });

  test('the button in the sheet header opens the settings as a dialog over the map', async ({
    page,
  }) => {
    await page.goto('/');
    const settingsButton = page
      .getByRole('region', { name: 'Tankstellen', exact: true })
      .getByRole('link', { name: 'Einstellungen', exact: true });

    await settingsButton.click();

    await expect(page).toHaveURL('/settings');
    await expect(page).toHaveTitle('Einstellungen – GenialTanken');
    const dialog = settingsDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Schließen', exact: true })).toBeFocused();
    await expect(stationsMap(page)).toBeVisible();

    await dialog.getByRole('button', { name: 'Schließen', exact: true }).click();

    await expect(page).toHaveURL('/');
    await expect(dialog).toBeHidden();
    await expect(settingsButton).toBeFocused();
  });

  test('a deep link opens the dialog over the map; Escape returns to the list', async ({
    page,
  }) => {
    await page.goto('/settings');
    const dialog = settingsDialog(page);
    await expect(dialog.getByRole('slider', { name: 'Radius: 5 km' })).toBeVisible();
    await expect(stationsMap(page)).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page).toHaveURL('/');
    await expect(dialog).toBeHidden();
    await expect(pageHeading(page, 'GenialTanken')).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: 'Tankstellen', exact: true })
        .getByRole('link', { name: 'Einstellungen', exact: true })
    ).toBeFocused();
  });

  test('changes apply immediately and survive a reload', async ({ page }) => {
    await page.goto('/settings');

    await chooseSettingsOption(fuelOptions(page), 'E10');
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

    const emptyMessage = 'Keine Tankstellen mit Preis für E10 im Umkreis von 1 km gefunden.';
    await expect(page.getByText(emptyMessage, { exact: true })).toBeVisible();
    // Announced once, by the result summary
    await expect(page.getByRole('status').filter({ hasText: emptyMessage })).toHaveCount(1);
    await expect(resultSummary(page)).toHaveText(emptyMessage);
    await expect(stationCards(page)).toHaveCount(0);
  });

  test('the color scheme applies immediately and survives a reload', async ({ page }) => {
    await page.goto('/settings');
    // Playwright emulates a light operating system unless a test asks for dark.
    await expectColorScheme(page, 'light');

    await chooseSettingsOption(colorSchemeOptions(page), 'Dunkel');
    await expectColorScheme(page, 'dark');
    await expect.poll(() => storedColorScheme(page)).toBe('dark');

    await page.reload();
    await expect(colorSchemeRadio(page, 'Dunkel')).toBeChecked();
    await expectColorScheme(page, 'dark');

    await chooseSettingsOption(colorSchemeOptions(page), 'Hell');
    await expectColorScheme(page, 'light');
    await expect.poll(() => storedColorScheme(page)).toBe('light');

    await chooseSettingsOption(colorSchemeOptions(page), 'System');
    await expectColorScheme(page, 'light');
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

    await expectColorScheme(page, 'dark');
    // Browsers use the first theme color whose media query matches.
    const appliedThemeColor = await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].find(
          meta => window.matchMedia(meta.media).matches
        )?.content
    );
    // The dark `--color-chrome` of tokens.scss, without its translucency.
    expect(appliedThemeColor).toBe('#1d1d1d');
  });

  test.describe('on a dark operating system', () => {
    test.use({ colorScheme: 'dark' });

    test('"System" follows the operating system and "Hell" overrides it', async ({ page }) => {
      await page.goto('/settings');

      await expect(colorSchemeRadio(page, 'System')).toBeChecked();
      await expectColorScheme(page, 'dark');

      await chooseSettingsOption(colorSchemeOptions(page), 'Hell');
      await expectColorScheme(page, 'light');

      await page.reload();
      await expect(colorSchemeRadio(page, 'Hell')).toBeChecked();
      await expectColorScheme(page, 'light');
    });
  });
});

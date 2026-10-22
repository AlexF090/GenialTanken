import type { Locator, Page } from '@playwright/test';
import {
  chooseFuel,
  eiffelTower,
  openExplore,
  expect,
  expectColorScheme,
  expectNoAccessibilityViolations,
  resultSummary,
  rueBailleulStation,
  settingsButton,
  sheetHandle,
  stationRowButton,
  stationCard,
  stationCards,
  stationList,
  stationsMap,
  installationHint,
  suggestHomeScreenSteps,
  test,
  useOwnPosition,
} from '../fixtures.ts';

/**
 * Pixels by which the top of an element lies below the bottom edge of the window, where map and
 * sheet end; negative while the element shows above it. The sheet animates, so callers poll.
 */
const offsetBelowWindow = async (page: Page, element: Locator): Promise<number> => {
  const elementBox = await element.boundingBox();
  const viewport = page.viewportSize();
  if (elementBox === null || viewport === null) {
    throw new Error('The element must be rendered in a page with a viewport.');
  }
  return elementBox.y - viewport.height;
};

/**
 * The sheet height comes from measured, fractional element heights, so at peek the list may
 * start up to a device pixel above the bottom edge; that is not visible.
 */
const SUBPIXEL_TOLERANCE_IN_PIXELS = 1;

/** The sheet itself, the region that holds handle, header and list. */
const sheet = (page: Page): Locator =>
  page.getByRole('region', { name: 'Tankstellen', exact: true });

/** Map and sheet reach the edges of the window: the map under the status bar, the sheet down. */
const expectFullBleed = async (page: Page): Promise<void> => {
  const viewport = page.viewportSize();
  const mapBox = await stationsMap(page).boundingBox();
  const sheetBox = await sheet(page).boundingBox();
  expect(mapBox).toMatchObject({ x: 0, y: 0, width: viewport?.width, height: viewport?.height });
  // The sheet slides down by its hidden part, so its untransformed bottom is the window's.
  const untransformedSheetBottom = await sheet(page).evaluate(
    element =>
      element.getBoundingClientRect().bottom -
      new DOMMatrix(getComputedStyle(element).transform).m42
  );
  expect(untransformedSheetBottom).toBeCloseTo(viewport?.height ?? 0, 0);
  expect(sheetBox?.width).toBe(viewport?.width);
};

const expectShownOnScreen = async (page: Page, element: Locator): Promise<void> => {
  await expect.poll(() => offsetBelowWindow(page, element)).toBeLessThan(0);
};

const expectSheetAt = async (
  page: Page,
  position: 'peek' | 'half' | 'full',
  handleLabel: 'Liste vergrößern' | 'Liste verkleinern'
): Promise<void> => {
  const handle = sheetHandle(page);
  await expect(handle).toHaveAccessibleName(handleLabel);
  await expect(handle).toHaveAttribute('aria-expanded', String(position !== 'peek'));
  // At peek only handle and header show; the list starts below the window.
  await (position === 'peek'
    ? expect
        .poll(() => offsetBelowWindow(page, stationList(page)))
        .toBeGreaterThanOrEqual(-SUBPIXEL_TOLERANCE_IN_PIXELS)
    : expectShownOnScreen(page, stationList(page)));
};

test.describe('bottom sheet on a phone', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(resultSummary(page)).toContainText(eiffelTower.label);
  });

  test('the map fills the window and the sheet reaches its bottom edge', async ({ page }) => {
    await expectFullBleed(page);
    // Nothing scrolls the document; only the sheet's content scrolls.
    const overflow = await page.evaluate(() => {
      const scrollingElement = document.scrollingElement ?? document.documentElement;
      return scrollingElement.scrollHeight - scrollingElement.clientHeight;
    });
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('the handle steps through the positions and turns around at either end', async ({
    page,
  }) => {
    await expectSheetAt(page, 'half', 'Liste vergrößern');

    await sheetHandle(page).click();
    await expectSheetAt(page, 'full', 'Liste verkleinern');

    await sheetHandle(page).click();
    await expectSheetAt(page, 'half', 'Liste verkleinern');

    await sheetHandle(page).click();
    await expectSheetAt(page, 'peek', 'Liste vergrößern');

    await sheetHandle(page).click();
    await expectSheetAt(page, 'half', 'Liste vergrößern');
  });

  test('the handle moves the sheet with the arrow, Home and End keys', async ({ page }) => {
    await sheetHandle(page).focus();

    await page.keyboard.press('Home');
    await expectSheetAt(page, 'peek', 'Liste vergrößern');

    await page.keyboard.press('ArrowDown');
    await expectSheetAt(page, 'peek', 'Liste vergrößern');

    await page.keyboard.press('ArrowUp');
    await expectSheetAt(page, 'half', 'Liste vergrößern');

    await page.keyboard.press('End');
    await expectSheetAt(page, 'full', 'Liste verkleinern');

    await page.keyboard.press('ArrowDown');
    await expectSheetAt(page, 'half', 'Liste verkleinern');

    await page.keyboard.press('ArrowDown');
    await expectSheetAt(page, 'peek', 'Liste vergrößern');
    await expect(sheetHandle(page)).toBeFocused();
  });

  test('focusing the list at peek opens the sheet, so the list stays reachable', async ({
    page,
  }) => {
    await sheetHandle(page).focus();
    await page.keyboard.press('Home');
    await expectSheetAt(page, 'peek', 'Liste vergrößern');

    const titleLink = stationCard(page, rueBailleulStation).getByRole('link');
    await titleLink.focus();

    await expect(sheetHandle(page)).toHaveAttribute('aria-expanded', 'true');
    await expectShownOnScreen(page, titleLink);
    await titleLink.click();
    await expect(page).toHaveURL(`/stations/${rueBailleulStation.id}`);
  });

  test('choosing a price tag on the map opens the sheet to half', async ({ page }) => {
    await sheetHandle(page).focus();
    await page.keyboard.press('Home');
    await expectSheetAt(page, 'peek', 'Liste vergrößern');

    await stationsMap(page)
      .getByRole('button', {
        name: `${rueBailleulStation.title}, 2,540 €, günstigster Preis`,
        exact: true,
      })
      .click();

    await expect(sheetHandle(page)).toHaveAttribute('aria-expanded', 'true');
    const listButton = stationRowButton(stationCard(page, rueBailleulStation), rueBailleulStation);
    await expect(listButton).toHaveAttribute('aria-pressed', 'true');
    await expectShownOnScreen(page, listButton);
  });

  test('choosing a row of the full sheet lowers it to half to show the map', async ({ page }) => {
    await sheetHandle(page).focus();
    await page.keyboard.press('End');
    await expectSheetAt(page, 'full', 'Liste verkleinern');

    await stationRowButton(stationCard(page, rueBailleulStation), rueBailleulStation).click();

    // Set from outside, the sheet keeps its last direction: the handle still offers "up".
    await expectSheetAt(page, 'half', 'Liste vergrößern');
    await expect(
      stationsMap(page).getByRole('button', {
        name: `${rueBailleulStation.title}, 2,540 €, günstigster Preis`,
        exact: true,
      })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('the place search opens the sheet fully and "Abbrechen" returns it', async ({ page }) => {
    await expectSheetAt(page, 'half', 'Liste vergrößern');
    const searchField = page.getByRole('combobox', { name: 'Ort suchen' });

    await searchField.pressSequentially('Bastille');

    await expect(sheetHandle(page)).toHaveAccessibleName('Liste verkleinern');
    const suggestions = sheet(page).getByRole('listbox', { name: 'Orte' }).getByRole('option');
    await expect(suggestions.first()).toContainText('Bastille');
    await expectShownOnScreen(page, suggestions.first());
    await expect(stationList(page)).toBeHidden();

    await sheet(page).getByRole('button', { name: 'Abbrechen', exact: true }).click();

    await expectSheetAt(page, 'half', 'Liste vergrößern');
    await expect(searchField).toHaveValue('');
    await expect(searchField).not.toBeFocused();
  });

  test('choosing a place lowers the sheet to half over the stations around it', async ({
    page,
  }) => {
    const searchField = page.getByRole('combobox', { name: 'Ort suchen' });
    await searchField.pressSequentially('Bastille');
    await sheet(page).getByRole('option').first().click();

    await expect(resultSummary(page)).toContainText('um Bastille');
    await expectSheetAt(page, 'half', 'Liste vergrößern');
  });

  test('Escape leaves the search like "Abbrechen"', async ({ page }) => {
    await sheetHandle(page).focus();
    await page.keyboard.press('Home');
    await expectSheetAt(page, 'peek', 'Liste vergrößern');
    const searchField = page.getByRole('combobox', { name: 'Ort suchen' });

    await searchField.focus();
    await expect(sheetHandle(page)).toHaveAccessibleName('Liste verkleinern');
    await page.keyboard.press('Escape');

    await expectSheetAt(page, 'peek', 'Liste vergrößern');
  });

  for (const width of [320, 393]) {
    test.describe(`at ${String(width)} CSS pixels`, () => {
      test.use({ viewport: { width, height: 640 } });

      test('keeps the search field and the settings button in one row', async ({ page }) => {
        const settings = settingsButton(page);
        const settingsBox = await settings.boundingBox();
        expect(settingsBox?.height).toBeGreaterThanOrEqual(44);
        expect(settingsBox?.width).toBeGreaterThanOrEqual(44);
        // Measured in one frame, as the sheet may still be sliding into place
        const row = await page.getByRole('combobox', { name: 'Ort suchen' }).evaluate(
          (field, settingsElement) => {
            const middle = (rectangle: DOMRect): number => rectangle.top + rectangle.height / 2;
            const fieldRectangle = field.getBoundingClientRect();
            const settingsRectangle = settingsElement.getBoundingClientRect();
            return {
              middleDistance: Math.abs(middle(fieldRectangle) - middle(settingsRectangle)),
              settingsRight: settingsRectangle.right,
            };
          },
          await settings.elementHandle()
        );
        expect(row.middleDistance).toBeLessThanOrEqual(1);
        expect(row.settingsRight).toBeLessThanOrEqual(width);
      });
    });
  }

  test.describe('on a short screen, where the four stations overflow the full sheet', () => {
    test.use({ viewport: { width: 412, height: 500 } });

    test('the full sheet scrolls the list only vertically', async ({ page }) => {
      await chooseFuel(page, 'Diesel');
      await openExplore(page);
      await useOwnPosition(page);
      await expect(stationCards(page)).toHaveCount(4);
      await expectFullBleed(page);
      await sheetHandle(page).focus();
      await page.keyboard.press('End');
      await expectSheetAt(page, 'full', 'Liste verkleinern');

      // The scroll container has no role of its own; it wraps the list inside the sheet region.
      const content = page
        .getByRole('region', { name: 'Tankstellen', exact: true })
        .locator('.bottom-sheet__content');
      const scrollPosition = () =>
        content.evaluate(element => ({
          left: element.scrollLeft,
          top: element.scrollTop,
          pageLeft: window.scrollX,
        }));
      const overflowsSideways = (element: Element): boolean =>
        element.scrollWidth > element.clientWidth;
      expect(await content.evaluate(overflowsSideways)).toBe(false);
      expect(await page.locator('html').evaluate(overflowsSideways)).toBe(false);
      // Panning a pinch-zoomed page sideways over the list must stay possible.
      await expect(content).toHaveCSS('touch-action', 'auto');
      // The rubber-band bounce at either end cannot be observed in Chromium; the setting can.
      await expect(content).toHaveCSS('overscroll-behavior-y', 'none');

      await stationCard(page, rueBailleulStation).hover();
      await page.mouse.wheel(200, 0);
      // Wheel events are handled in order: once the list has scrolled down, the sideways one was too.
      await page.mouse.wheel(0, 200);
      await expect.poll(async () => (await scrollPosition()).top).toBeGreaterThan(0);

      expect(await scrollPosition()).toMatchObject({ left: 0, pageLeft: 0 });
    });
  });
});

test.describe('installation hint in the browser of an iPhone', () => {
  test.beforeEach(async ({ page }) => {
    await suggestHomeScreenSteps(page);
    await page.goto('/');
    await expect(resultSummary(page)).toContainText(eiffelTower.label);
  });

  test('suggests the home screen once and stays closed after a reload', async ({ page }) => {
    const hint = installationHint(page);
    await expect(hint).toContainText('Tippe auf Teilen und dann auf „Zum Home-Bildschirm“.');

    const closeButton = hint.getByRole('button', { name: 'Hinweis schließen', exact: true });
    const closeButtonBox = await closeButton.boundingBox();
    expect(closeButtonBox?.width).toBeGreaterThanOrEqual(44);
    expect(closeButtonBox?.height).toBeGreaterThanOrEqual(44);
    await closeButton.click();
    await expect(hint).toHaveCount(0);

    await page.reload();
    await expect(resultSummary(page)).toContainText(eiffelTower.label);
    await expect(installationHint(page)).toHaveCount(0);
  });

  test('has no WCAG 2.2 AAA violations, in the dark too', async ({ page }) => {
    await expect(installationHint(page)).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expectColorScheme(page, 'dark');
    await expectNoAccessibilityViolations(page);
  });

  test.describe('at 320 CSS pixels', () => {
    test.use({ viewport: { width: 320, height: 640 } });

    test('does not scroll horizontally', async ({ page }) => {
      await expect(installationHint(page)).toBeVisible();
      const overflow = await page.evaluate(() => {
        const scrollingElement = document.scrollingElement ?? document.documentElement;
        return scrollingElement.scrollWidth - scrollingElement.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
});

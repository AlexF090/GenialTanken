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
  openedStationCard,
  suggestHomeScreenSteps,
  swipe,
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

const renderedBox = async (
  element: Locator
): Promise<{ x: number; y: number; width: number; height: number }> => {
  const box = await element.boundingBox();
  if (box === null) {
    throw new Error('The element must be rendered.');
  }
  return box;
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

  test('half opens the sheet to about 55 % of the window, with room for two stations', async ({
    page,
  }) => {
    await expectSheetAt(page, 'half', 'Liste vergrößern');
    const windowHeight = page.viewportSize()?.height ?? 0;

    await expect
      .poll(async () => (await sheet(page).boundingBox())?.y ?? 0)
      .toBeCloseTo(windowHeight * 0.45, -1);
    // Only one station lies around the Eiffel Tower; a second row of its height fits below it.
    const firstStationBox = await stationCards(page).first().boundingBox();
    expect((firstStationBox?.y ?? 0) + 2 * (firstStationBox?.height ?? 0)).toBeLessThanOrEqual(
      windowHeight
    );
  });

  test('the header keeps compact controls with touch targets of 44 px', async ({ page }) => {
    const fuelChip = sheet(page).getByRole('button', { name: /^Kraftstoff:/ });
    const refreshButton = sheet(page).getByRole('button', { name: 'Aktualisieren', exact: true });

    for (const control of [fuelChip, refreshButton]) {
      const box = await control.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    const capsuleHeight = await fuelChip.evaluate(button =>
      button.parentElement === null
        ? 0
        : Number.parseFloat(getComputedStyle(button.parentElement, '::before').height)
    );
    expect(capsuleHeight).toBeGreaterThanOrEqual(32);
    expect(capsuleHeight).toBeLessThan(44);
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
    await expect(listButton).toHaveAttribute('aria-current', 'true');
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

  test.describe('the list leads the sheet', () => {
    const content = (page: Page): Locator => sheet(page).locator('.bottom-sheet__content');

    const sheetTop = async (page: Page): Promise<number> => (await renderedBox(sheet(page))).y;

    /** Resolves once the sheet stopped sliding, and returns where it rests. */
    const settledSheetTop = async (page: Page): Promise<number> => {
      let previousTop = Number.NaN;
      await expect
        .poll(async () => {
          const top = await sheetTop(page);
          const hasSettled = top === previousTop;
          previousTop = top;
          return hasSettled;
        })
        .toBe(true);
      return previousTop;
    };

    const centerOf = async (element: Locator): Promise<{ x: number; y: number }> => {
      const box = await renderedBox(element);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };

    test('has touch-action that lets the sheet take vertical swipes only below full', async ({
      page,
    }) => {
      await expectSheetAt(page, 'half', 'Liste vergrößern');
      await expect(sheet(page)).toHaveClass(/bottom-sheet--content-leads/);
      await expect(content(page)).toHaveCSS('touch-action', 'pan-x pinch-zoom');

      await sheetHandle(page).focus();
      await page.keyboard.press('Home');
      await expectSheetAt(page, 'peek', 'Liste vergrößern');
      await expect(content(page)).toHaveCSS('touch-action', 'pan-x pinch-zoom');

      await page.keyboard.press('End');
      await expectSheetAt(page, 'full', 'Liste verkleinern');
      await expect(content(page)).toHaveCSS('touch-action', 'auto');
    });

    test('a swipe up at half opens the sheet fully without choosing the station', async ({
      page,
    }) => {
      await expectSheetAt(page, 'half', 'Liste vergrößern');
      const row = stationRowButton(stationCard(page, rueBailleulStation), rueBailleulStation);
      const start = await centerOf(row);

      await swipe(page, start, { x: start.x, y: start.y - 300 });

      await expectSheetAt(page, 'full', 'Liste verkleinern');
      await expect(page).toHaveURL('/');
      await expect(row).not.toHaveAttribute('aria-current', 'true');
    });

    test('the sheet follows the finger and rests at full after the finger lifts', async ({
      page,
    }) => {
      await expectSheetAt(page, 'half', 'Liste vergrößern');
      const halfTop = await settledSheetTop(page);
      const start = await centerOf(stationCard(page, rueBailleulStation));

      const liftFinger = await swipe(
        page,
        start,
        { x: start.x, y: start.y - 250 },
        { release: false, steps: 25, stepDelayInMilliseconds: 20 }
      );
      try {
        await expect.poll(() => sheetTop(page)).toBeLessThan(halfTop - 100);
        // Only a part of the way to full: the sheet moved with the finger, it did not jump.
        expect(await sheetTop(page)).toBeGreaterThan(0);
      } finally {
        await liftFinger();
      }

      await expectSheetAt(page, 'full', 'Liste verkleinern');
    });

    test('a short swipe up at half returns the sheet to half', async ({ page }) => {
      await expectSheetAt(page, 'half', 'Liste vergrößern');
      const halfTop = await settledSheetTop(page);
      const start = await centerOf(stationCard(page, rueBailleulStation));

      await swipe(page, start, { x: start.x, y: start.y - 30 }, { stepDelayInMilliseconds: 50 });

      await expectSheetAt(page, 'half', 'Liste vergrößern');
      expect(await settledSheetTop(page)).toBeCloseTo(halfTop, 0);
    });

    test('a tap on a row at half still chooses the station', async ({ page }) => {
      await expectSheetAt(page, 'half', 'Liste vergrößern');
      const row = stationRowButton(stationCard(page, rueBailleulStation), rueBailleulStation);
      const target = await centerOf(row);

      await page.touchscreen.tap(target.x, target.y);

      await expect(row).toHaveAttribute('aria-current', 'true');
      await expectSheetAt(page, 'half', 'Liste vergrößern');
    });

    test('the mouse wheel steps the sheet up to full and back down to half', async ({ page }) => {
      await expectSheetAt(page, 'half', 'Liste vergrößern');
      const halfTop = await settledSheetTop(page);
      await stationCard(page, rueBailleulStation).hover();

      await page.mouse.wheel(0, 100);
      await expectSheetAt(page, 'full', 'Liste verkleinern');
      await settledSheetTop(page);

      await page.mouse.wheel(0, -100);
      // Set by the wheel, not the handle, the sheet keeps its direction: the label may stay.
      await expect.poll(() => sheetTop(page)).toBe(halfTop);
      await expect(sheetHandle(page)).toHaveAttribute('aria-expanded', 'true');
    });

    test.describe('on a short screen, where the four stations overflow the full sheet', () => {
      test.use({ viewport: { width: 412, height: 500 } });

      test.beforeEach(async ({ page }) => {
        await chooseFuel(page, 'Diesel');
        await openExplore(page);
        await useOwnPosition(page);
        await expect(stationCards(page)).toHaveCount(4);
      });

      test('at full a swipe up scrolls the list and leaves the sheet where it is', async ({
        page,
      }) => {
        await sheetHandle(page).focus();
        await page.keyboard.press('End');
        await expectSheetAt(page, 'full', 'Liste verkleinern');
        const fullTop = await settledSheetTop(page);
        const start = await centerOf(stationCards(page).nth(1));

        await swipe(page, start, { x: start.x, y: start.y - 150 });

        await expect
          .poll(() => content(page).evaluate(element => element.scrollTop))
          .toBeGreaterThan(0);
        expect(await sheetTop(page)).toBe(fullTop);
        await expectSheetAt(page, 'full', 'Liste verkleinern');
      });

      test('at full with the list at its top a swipe down lowers the sheet to half', async ({
        page,
      }) => {
        await sheetHandle(page).focus();
        await page.keyboard.press('End');
        await expectSheetAt(page, 'full', 'Liste verkleinern');
        await expect.poll(() => content(page).evaluate(element => element.scrollTop)).toBe(0);
        const start = await centerOf(stationCards(page).first());

        const fullTop = await settledSheetTop(page);

        await swipe(
          page,
          start,
          { x: start.x, y: start.y + 140 },
          { steps: 14, stepDelayInMilliseconds: 40 }
        );

        await expect.poll(() => sheetTop(page)).toBeGreaterThan(fullTop + 100);
        await expect(sheetHandle(page)).toHaveAttribute('aria-expanded', 'true');
        await expectShownOnScreen(page, stationList(page));
      });

      test('at full with a scrolled list a swipe down scrolls back and keeps the sheet', async ({
        page,
      }) => {
        await sheetHandle(page).focus();
        await page.keyboard.press('End');
        await expectSheetAt(page, 'full', 'Liste verkleinern');
        await content(page).evaluate(element => {
          element.scrollTop = 120;
        });
        const fullTop = await settledSheetTop(page);
        const start = await centerOf(stationCards(page).nth(1));

        await swipe(page, start, { x: start.x, y: start.y + 60 });

        await expectSheetAt(page, 'full', 'Liste verkleinern');
        expect(await sheetTop(page)).toBe(fullTop);
      });
    });

    test('the place search keeps the sheet where it is under swipes and the wheel', async ({
      page,
    }) => {
      await page.getByRole('combobox', { name: 'Ort suchen' }).pressSequentially('Bastille');
      const suggestions = sheet(page).getByRole('listbox', { name: 'Orte' }).getByRole('option');
      await expect(suggestions.first()).toContainText('Bastille');
      await expect(sheetHandle(page)).toHaveAccessibleName('Liste verkleinern');
      const fullTop = await settledSheetTop(page);
      const start = await centerOf(suggestions.first());

      await swipe(page, start, { x: start.x, y: start.y + 250 });
      await page.mouse.move(start.x, start.y);
      await page.mouse.wheel(0, -100);

      await expect(sheetHandle(page)).toHaveAccessibleName('Liste verkleinern');
      expect(await settledSheetTop(page)).toBe(fullTop);
    });

    test('an opened station card keeps the sheet where it is under swipes and the wheel', async ({
      page,
    }) => {
      await page.goto(`/stations/${rueBailleulStation.id}`);
      const card = openedStationCard(page);
      await expect(card).toBeVisible();
      await expect(sheetHandle(page)).toHaveAccessibleName('Liste vergrößern');
      await expect(sheet(page)).not.toHaveClass(/bottom-sheet--content-leads/);
      const halfTop = await settledSheetTop(page);
      const start = await centerOf(card);

      await swipe(page, start, { x: start.x, y: start.y - 300 });
      await page.mouse.move(start.x, start.y);
      await page.mouse.wheel(0, 100);

      await expect(sheetHandle(page)).toHaveAccessibleName('Liste vergrößern');
      expect(await settledSheetTop(page)).toBe(halfTop);
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
    const steps = hint.getByText('Tippe auf Teilen und dann auf „Zum Home-Bildschirm“.');
    await expect(steps).toBeHidden();
    const disclosure = hint.getByRole('button', { name: 'So geht’s', exact: true });
    await disclosure.click();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    await expect(steps).toBeVisible();

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

  test('sits after the third station and leaves the list whole once closed', async ({ page }) => {
    await chooseFuel(page, 'Diesel');
    await openExplore(page);
    await useOwnPosition(page);
    const hint = installationHint(page);
    const furtherStations = page
      .getByRole('main')
      .getByRole('list', { name: 'Weitere Tankstellen', exact: true });
    await expect(stationCards(page)).toHaveCount(3);
    await expect(furtherStations.getByRole('listitem').first()).toBeAttached();

    // The sheet may still be moving, so the boxes are compared once it settled.
    await expect
      .poll(async () => {
        const [thirdStationBox, hintBox, fourthStationBox] = await Promise.all([
          renderedBox(stationCards(page).nth(2)),
          renderedBox(hint),
          renderedBox(furtherStations.getByRole('listitem').first()),
        ]);
        return (
          thirdStationBox.y + thirdStationBox.height <= hintBox.y &&
          hintBox.y + hintBox.height <= fourthStationBox.y
        );
      })
      .toBe(true);

    const closeButton = hint.getByRole('button', { name: 'Hinweis schließen', exact: true });
    await closeButton.click();
    await expect(hint).toHaveCount(0);
    await expect(furtherStations).toHaveCount(0);
    await expect(stationCards(page).nth(3)).toBeVisible();
    // The focus continues at the station that followed the hint.
    await expect(stationCards(page).nth(3).getByRole('button').first()).toBeFocused();
  });

  test('has no WCAG 2.2 AAA violations, in the dark too', async ({ page }) => {
    await expect(installationHint(page)).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await installationHint(page).getByRole('button', { name: 'So geht’s', exact: true }).click();
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

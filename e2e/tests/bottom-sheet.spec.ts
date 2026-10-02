import type { Locator, Page } from '@playwright/test';
import {
  eiffelTower,
  expect,
  resultSummary,
  rueBailleulStation,
  stationRowButton,
  stationCard,
  stationList,
  stationsMap,
  test,
} from '../fixtures.js';

/** The list floats over the map as a sheet whose handle names the next step. */
const sheetHandle = (page: Page): Locator =>
  page
    .getByRole('region', { name: 'Tankstellen', exact: true })
    .getByRole('button', { name: /^Liste (vergrößern|verkleinern)$/ });

/**
 * Pixels by which the top of an element lies below the visible map, which ends at the navigation
 * bar; negative while the element shows above it. The sheet animates, so callers poll.
 */
const offsetBelowMap = async (page: Page, element: Locator): Promise<number> => {
  const elementBox = await element.boundingBox();
  const mapBox = await stationsMap(page).boundingBox();
  if (elementBox === null || mapBox === null) {
    throw new Error('Element and map must be rendered to compare their positions.');
  }
  return elementBox.y - (mapBox.y + mapBox.height);
};

const expectShownOnScreen = async (page: Page, element: Locator): Promise<void> => {
  await expect.poll(() => offsetBelowMap(page, element)).toBeLessThan(0);
};

const expectSheetAt = async (
  page: Page,
  position: 'peek' | 'half' | 'full',
  handleLabel: 'Liste vergrößern' | 'Liste verkleinern'
): Promise<void> => {
  const handle = sheetHandle(page);
  await expect(handle).toHaveAccessibleName(handleLabel);
  await expect(handle).toHaveAttribute('aria-expanded', String(position !== 'peek'));
  // At peek only handle and header show; the list starts behind the navigation bar.
  await (position === 'peek'
    ? expect.poll(() => offsetBelowMap(page, stationList(page))).toBeGreaterThanOrEqual(0)
    : expectShownOnScreen(page, stationList(page)));
};

test.describe('bottom sheet on a phone', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(resultSummary(page)).toContainText(eiffelTower.label);
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
});

import type { Locator, Page } from '@playwright/test';
import { expect, resultSummary, test } from '../fixtures.ts';

/** How far the search area may lie from the middle of the visible map, e.g. through rounding. */
const TOLERANCE_IN_PIXELS = 24;

const boxOf = async (element: Locator): Promise<{ x: number; y: number; width: number }> => {
  const box = await element.boundingBox();
  if (box === null) {
    throw new Error('The element has no size');
  }
  return box;
};

const sidePanel = (page: Page): Locator =>
  page.getByRole('region', { name: 'Tankstellen', exact: true });

/**
 * Horizontal distance of the radius circle's middle from the middle of the map area right of the
 * side panel, once the map stopped moving.
 */
const expectSearchAreaCenteredRightOfPanel = async (page: Page): Promise<void> => {
  const viewportWidth = page.viewportSize()?.width ?? 0;
  const panelBox = await boxOf(sidePanel(page));
  const visibleAreaMiddle = (panelBox.x + panelBox.width + viewportWidth) / 2;
  const radiusCircle = page.locator('path.search-radius');
  await expect(async () => {
    const circleBox = await boxOf(radiusCircle);
    const circleMiddle = circleBox.x + circleBox.width / 2;
    expect(Math.abs(circleMiddle - visibleAreaMiddle)).toBeLessThanOrEqual(TOLERANCE_IN_PIXELS);
  }).toPass();
};

test.describe('search area on a wide window', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(resultSummary(page)).toContainText('Eiffelturm');
  });

  test('the start search area lies in the map area right of the side panel', async ({ page }) => {
    await expectSearchAreaCenteredRightOfPanel(page);
  });

  test('a chosen place is searched in the map area right of the side panel', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Ort suchen' }).pressSequentially('Bastille');
    const suggestions = sidePanel(page).getByRole('listbox', { name: 'Orte' }).getByRole('option');
    await expect(suggestions.first()).toContainText('Bastille');
    await suggestions.first().click();
    await expect(resultSummary(page)).toContainText('um Bastille');

    await expectSearchAreaCenteredRightOfPanel(page);
  });
});

import { AxeBuilder } from '@axe-core/playwright';
import { expect, quaiDeLaRapeeStation, test } from '../fixtures.js';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

interface PageUnderTest {
  name: string;
  path: string;
  readyText: string | RegExp;
}

const PAGES: PageUnderTest[] = [
  { name: 'station list', path: '/', readyText: 'Sortiert nach: km' },
  { name: 'map', path: '/map', readyText: 'Du bist hier!' },
  { name: 'favorites', path: '/favorites', readyText: 'Keine Favoriten gespeichert' },
  { name: 'settings', path: '/settings', readyText: 'Radius: 5 km' },
  {
    name: 'station detail',
    path: `/stations/${quaiDeLaRapeeStation.id}`,
    readyText: 'Öffnungszeiten',
  },
  { name: 'not found', path: '/does-not-exist', readyText: 'ERROR 404' },
];

test.describe('accessibility', () => {
  for (const pageUnderTest of PAGES) {
    test(`${pageUnderTest.name} page has no WCAG 2.2 AA violations`, async ({ page }) => {
      await page.goto(pageUnderTest.path);
      await expect(page.getByText(pageUnderTest.readyText).first()).toBeVisible();

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(
        results.violations.map(violation => ({
          rule: violation.id,
          impact: violation.impact,
          targets: violation.nodes.map(node => node.target.join(' ')),
        }))
      ).toEqual([]);
    });
  }
});

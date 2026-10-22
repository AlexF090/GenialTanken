import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import {
  eiffelTower,
  expect,
  expectColorScheme,
  quaiDeLaRapeeStation,
  resultSummary,
  rueBailleulStation,
  seedFavorites,
  stationCard,
  test,
} from '../fixtures.ts';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

interface PageUnderTest {
  name: string;
  path: string;
  /** Runs before the page loads, e.g. to seed the browser storage. */
  prepare?: (page: Page) => Promise<void>;
  /** Resolves once the page shows its loaded content. */
  isReady: (page: Page) => Promise<void>;
}

const PAGES: PageUnderTest[] = [
  {
    name: 'explore',
    path: '/',
    isReady: page => expect(resultSummary(page)).toContainText(eiffelTower.label),
  },
  {
    name: 'empty favorites',
    path: '/favorites',
    isReady: page =>
      expect(
        page.getByRole('heading', { level: 2, name: 'Keine Favoriten gespeichert' })
      ).toBeVisible(),
  },
  {
    name: 'favorites',
    path: '/favorites',
    prepare: page => seedFavorites(page, [rueBailleulStation.id, quaiDeLaRapeeStation.id]),
    isReady: async page => {
      await expect(stationCard(page, rueBailleulStation)).toContainText('2,540 €');
      await expect(stationCard(page, quaiDeLaRapeeStation)).toContainText('kein Preis');
    },
  },
  {
    name: 'settings',
    path: '/settings',
    isReady: page => expect(page.getByRole('slider', { name: 'Radius: 5 km' })).toBeVisible(),
  },
  {
    name: 'station detail',
    path: `/stations/${quaiDeLaRapeeStation.id}`,
    isReady: page => expect(page.getByRole('region', { name: 'Preise' })).toContainText('2,391 €'),
  },
  {
    name: 'not found',
    path: '/does-not-exist',
    isReady: page =>
      expect(page.getByRole('heading', { level: 2, name: 'Fehler 404' })).toBeVisible(),
  },
];

const expectNoViolations = async (page: Page): Promise<void> => {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  expect(
    results.violations.map(violation => ({
      rule: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map(node => node.target.join(' ')),
    }))
  ).toEqual([]);
};

const checkEveryPage = (): void => {
  for (const pageUnderTest of PAGES) {
    test(`${pageUnderTest.name} page has no WCAG 2.2 AA violations`, async ({ page }) => {
      await pageUnderTest.prepare?.(page);
      await page.goto(pageUnderTest.path);
      await pageUnderTest.isReady(page);

      await expectNoViolations(page);
    });
  }
};

test.describe('accessibility', () => {
  checkEveryPage();
});

test.describe('accessibility in dark mode', () => {
  // The default "System" preference follows the emulated operating system.
  test.use({ colorScheme: 'dark' });

  test('the system preference resolves to the dark color scheme', async ({ page }) => {
    await page.goto('/');

    await expectColorScheme(page, 'dark');
  });

  checkEveryPage();
});

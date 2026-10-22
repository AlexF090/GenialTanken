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
  /** Brings the loaded page into the state under test, e.g. opens a menu, and waits for it. */
  enterState?: (page: Page) => Promise<void>;
}

const isExploreReady = (page: Page): Promise<void> =>
  expect(resultSummary(page)).toContainText(eiffelTower.label);

/** No station lies within 1 km of the Eiffel Tower. */
const storeOneKilometerRadius = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'genialtanken.settings',
      JSON.stringify({ fuelType: 'e5', radiusInKilometers: 1, colorScheme: 'system' })
    );
  });
};

const PAGES: PageUnderTest[] = [
  {
    name: 'explore',
    path: '/',
    isReady: isExploreReady,
  },
  {
    name: 'explore with an empty result',
    path: '/',
    prepare: storeOneKilometerRadius,
    isReady: page =>
      expect(resultSummary(page)).toHaveText(
        'Keine Tankstellen mit Preis für E5 im Umkreis von 1 km gefunden.'
      ),
  },
  {
    name: 'explore with the open fuel menu',
    path: '/',
    isReady: isExploreReady,
    enterState: async page => {
      await page.getByRole('button', { name: 'Kraftstoff: E5', exact: true }).click();
      await expect(
        page
          .getByRole('menu', { name: 'Kraftstoff' })
          .getByRole('menuitemradio', { name: 'Super E5' })
      ).toBeVisible();
    },
  },
  {
    name: 'explore with place suggestions',
    path: '/',
    isReady: isExploreReady,
    enterState: async page => {
      const searchField = page.getByRole('combobox', { name: 'Ort suchen' });
      await searchField.pressSequentially('Bastille');
      await expect(searchField).toHaveAttribute('aria-expanded', 'true');
      await expect(
        page.getByRole('listbox', { name: 'Orte' }).getByRole('option').first()
      ).toContainText('Bastille');
    },
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
    name: 'opened station card',
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
    test(`${pageUnderTest.name} has no WCAG 2.2 AA violations`, async ({ page }) => {
      await pageUnderTest.prepare?.(page);
      await page.goto(pageUnderTest.path);
      await pageUnderTest.isReady(page);
      await pageUnderTest.enterState?.(page);

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

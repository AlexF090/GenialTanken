import type { Page } from '@playwright/test';
import {
  eiffelTower,
  expect,
  expectColorScheme,
  expectNoAccessibilityViolations,
  favoritesRow,
  quaiDeLaRapeeStation,
  resultSummary,
  rueBailleulStation,
  seedFavorites,
  stationCard,
  test,
} from '../fixtures.ts';

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
    name: 'explore with the open radius menu',
    path: '/',
    isReady: isExploreReady,
    enterState: async page => {
      await page.getByRole('button', { name: 'Radius: 5 km', exact: true }).click();
      await expect(
        page
          .getByRole('menu', { name: 'Radius' })
          .getByRole('menuitemradio', { name: '5 km', exact: true })
      ).toBeVisible();
    },
  },
  {
    name: 'explore with the open sort menu',
    path: '/',
    isReady: isExploreReady,
    enterState: async page => {
      await page.getByRole('button', { name: 'Sortierung: Entfernung', exact: true }).click();
      await expect(
        page.getByRole('menu', { name: 'Sortierung' }).getByRole('menuitemradio', { name: 'Preis' })
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
    name: 'explore with favorites',
    path: '/',
    prepare: page => seedFavorites(page, [rueBailleulStation.id, quaiDeLaRapeeStation.id]),
    isReady: async page => {
      await isExploreReady(page);
      await expect(
        favoritesRow(page).getByRole('link', { name: rueBailleulStation.title })
      ).toContainText('2,540 €');
    },
  },
  {
    name: 'empty favorites',
    path: '/favorites',
    isReady: page =>
      expect(
        page.getByRole('heading', { level: 3, name: 'Keine Favoriten gespeichert' })
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
    // The dialog slides in; axe must not measure contrast halfway.
    isReady: async page => {
      await expect(page.getByRole('slider', { name: 'Radius: 5 km' })).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveJSProperty('open', true);
      await page.waitForFunction(() =>
        document.getAnimations().every(animation => animation.playState !== 'running')
      );
    },
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

const checkPages = (pagesUnderTest: PageUnderTest[]): void => {
  for (const pageUnderTest of pagesUnderTest) {
    test(`${pageUnderTest.name} has no WCAG 2.2 AAA violations`, async ({ page }) => {
      await pageUnderTest.prepare?.(page);
      await page.goto(pageUnderTest.path);
      await pageUnderTest.isReady(page);
      await pageUnderTest.enterState?.(page);

      await expectNoAccessibilityViolations(page);
    });
  }
};

const checkEveryPage = (): void => {
  checkPages(PAGES);
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

interface DisplayPreference {
  name: string;
  /** Emulates the preference before the page loads. */
  emulate: (page: Page) => Promise<void>;
}

// Both turn the translucent materials opaque; the main surfaces cover what changes.
const DISPLAY_PREFERENCES: DisplayPreference[] = [
  {
    name: 'more contrast',
    emulate: page => page.emulateMedia({ contrast: 'more' }),
  },
  {
    name: 'reduced transparency',
    // Playwright has no option for it yet; Chromium emulates it through the DevTools protocol.
    emulate: async page => {
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
      });
    },
  },
];

const PAGES_UNDER_DISPLAY_PREFERENCES = PAGES.filter(pageUnderTest =>
  ['explore', 'opened station card', 'settings', 'favorites'].includes(pageUnderTest.name)
);

for (const preference of DISPLAY_PREFERENCES) {
  test.describe(`accessibility with ${preference.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await preference.emulate(page);
    });

    checkPages(PAGES_UNDER_DISPLAY_PREFERENCES);
  });
}

test.describe('reflow at 320 CSS pixels', () => {
  // 1.4.10 Reflow: content fits a 320 pixel wide viewport without horizontal scrolling.
  test.use({ viewport: { width: 320, height: 640 } });

  const pagesUnderTest = PAGES.filter(pageUnderTest =>
    [
      'explore',
      'explore with favorites',
      'explore with place suggestions',
      'favorites',
      'settings',
    ].includes(pageUnderTest.name)
  );

  for (const pageUnderTest of pagesUnderTest) {
    test(`${pageUnderTest.name} does not scroll horizontally`, async ({ page }) => {
      await pageUnderTest.prepare?.(page);
      await page.goto(pageUnderTest.path);
      await pageUnderTest.isReady(page);
      await pageUnderTest.enterState?.(page);

      const overflow = await page.evaluate(() => {
        const scrollingElement = document.scrollingElement ?? document.documentElement;
        return scrollingElement.scrollWidth - scrollingElement.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

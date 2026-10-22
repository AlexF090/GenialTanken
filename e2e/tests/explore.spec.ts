import type { Locator, Page } from '@playwright/test';
import { z } from 'zod';
import {
  boulevardDeLHopitalStation,
  boulevardVincentAuriolStation,
  chooseFuel,
  eiffelTower,
  expect,
  favoriteButton,
  openExplore,
  openSettings,
  pageHeading,
  quaiDeLaRapeeStation,
  resultSummary,
  rueBailleulStation,
  stationRowButton,
  stationCard,
  stationCards,
  stationsMap,
  test,
  useOwnPosition,
} from '../fixtures.ts';

const GEOLOCATION_CALL_COUNT_PROPERTY = 'e2eGeolocationCallCount';

/** Counts every position request of the page, so tests can prove when the app asks for it. */
const countGeolocationCalls = async (page: Page): Promise<void> => {
  await page.addInitScript(property => {
    Reflect.set(window, property, 0);
    const countCall = (): void => {
      Reflect.set(window, property, Number(Reflect.get(window, property)) + 1);
    };
    const geolocation = navigator.geolocation;
    const getCurrentPosition = geolocation.getCurrentPosition.bind(geolocation);
    const watchPosition = geolocation.watchPosition.bind(geolocation);
    geolocation.getCurrentPosition = (...parameters) => {
      countCall();
      getCurrentPosition(...parameters);
    };
    geolocation.watchPosition = (...parameters) => {
      countCall();
      return watchPosition(...parameters);
    };
  }, GEOLOCATION_CALL_COUNT_PROPERTY);
};

const geolocationCallCount = (page: Page): Promise<unknown> =>
  page.evaluate(
    (property): unknown => Reflect.get(window, property),
    GEOLOCATION_CALL_COUNT_PROPERTY
  );

const LAST_POINTER_MOVE_TIME_PROPERTY = 'e2eLastPointerMoveTime';
/**
 * Leaflet's inertia only considers pointer positions of the last 50 ms before release
 * (`Map.Drag._prunePositions`). Released any sooner, the map keeps gliding for a distance and time
 * that depend on how fast the input events arrived, i.e. on the load of the machine.
 */
const LEAFLET_INERTIA_WINDOW_IN_MILLISECONDS = 50;

/**
 * Drags the map like a user who holds the pointer still before letting go, so the map stops where
 * it was released and announces the new center at once.
 */
const dragMapWithoutInertia = async (
  page: Page,
  start: { x: number; y: number },
  offset: { x: number; y: number }
): Promise<void> => {
  await page.evaluate(property => {
    document.addEventListener('mousemove', () => {
      Reflect.set(window, property, performance.now());
    });
  }, LAST_POINTER_MOVE_TIME_PROPERTY);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + offset.x, start.y + offset.y, { steps: 10 });
  await page.waitForFunction(
    ([property, inertiaWindowInMilliseconds]) =>
      performance.now() - Number(Reflect.get(window, property)) > inertiaWindowInMilliseconds,
    [LAST_POINTER_MOVE_TIME_PROPERTY, LEAFLET_INERTIA_WINDOW_IN_MILLISECONDS] as const
  );
  await page.mouse.up();
};

const lowerMiddleOfMap = async (page: Page): Promise<{ x: number; y: number }> => {
  const mapBox = await stationsMap(page).boundingBox();
  if (mapBox === null) {
    throw new Error('The map has no size');
  }
  return { x: mapBox.x + mapBox.width / 2, y: mapBox.y + mapBox.height * 0.75 };
};

/** Keys that activate a focused price tag or cluster, as on a native button. */
const ACTIVATION_KEYS = ['Enter', 'Space'] as const;

/** At 60 frames per second longer than any map animation of Leaflet (250 ms). */
const SETTLED_FRAME_COUNT = 20;
const MAXIMUM_FRAME_COUNT = 600;

/**
 * Waits until the map has stopped moving the element: it stays attached and in place for
 * `SETTLED_FRAME_COUNT` frames in a row. Retried while the map replaces the element.
 */
const waitUntilSettled = async (element: Locator): Promise<void> => {
  await expect(async () => {
    const isSettled = await element.evaluate(
      (node, frameCounts) =>
        new Promise<boolean>(resolve => {
          let previous = node.getBoundingClientRect();
          let settledFrames = 0;
          let frames = 0;
          const check = (): void => {
            frames += 1;
            if (!node.isConnected || frames > frameCounts.maximum) {
              resolve(false);
              return;
            }
            const current = node.getBoundingClientRect();
            settledFrames =
              current.x === previous.x && current.y === previous.y ? settledFrames + 1 : 0;
            previous = current;
            if (settledFrames >= frameCounts.settled) {
              resolve(true);
              return;
            }
            requestAnimationFrame(check);
          };
          requestAnimationFrame(check);
        }),
      { settled: SETTLED_FRAME_COUNT, maximum: MAXIMUM_FRAME_COUNT }
    );
    expect(isSettled, 'the map has stopped moving the element').toBe(true);
  }).toPass();
};

/** The part of a station of `GET /api/stations` that the refresh test changes. */
const refreshedStationSchema = z.looseObject({
  id: z.string(),
  pricesInEuro: z.record(z.string(), z.number().nullable()),
});

const sortOptions = (page: Page) => page.getByRole('group', { name: 'Sortierung', exact: true });

test.describe('explore page', () => {
  test('starts at the Eiffel Tower without asking for the own position', async ({ page }) => {
    await countGeolocationCalls(page);
    await page.goto('/');

    await expect(page).toHaveTitle('GenialTanken');
    await expect(pageHeading(page, 'GenialTanken')).toBeVisible();
    // Only Rue Bailleul is within 5 km of the Eiffel Tower and sells E5 (sp95).
    await expect(resultSummary(page)).toHaveText(
      `1 Tankstelle im Umkreis von 5 km um ${eiffelTower.label}`
    );
    await expect(stationCards(page)).toHaveCount(1);
    await expect(page.getByText('Tankstellen werden geladen …')).toBeHidden();

    const card = stationCard(page, rueBailleulStation);
    await expect(card.getByRole('link')).toHaveAttribute(
      'href',
      `/stations/${rueBailleulStation.id}`
    );
    await expect(card).toContainText(rueBailleulStation.cityLine);
    await expect(card).toContainText('2,540 €');
    await expect(card).toContainText('3,41 km');
    await expect(favoriteButton(card, rueBailleulStation)).toHaveAttribute('aria-pressed', 'false');

    const map = stationsMap(page);
    await expect(map.getByText(eiffelTower.label, { exact: true })).toBeVisible();
    await expect(map.getByText('Du bist hier!', { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'Preisdaten: prix-carburants.gouv.fr (öffnet in neuem Tab)' })
    ).toHaveAttribute('href', 'https://www.prix-carburants.gouv.fr/');

    expect(await geolocationCallCount(page)).toBe(0);
  });

  test('"Meinen Standort verwenden" centers the search on the own position', async ({ page }) => {
    await countGeolocationCalls(page);
    await page.goto('/');
    await chooseFuel(page, 'Diesel');
    await openExplore(page);
    await expect(resultSummary(page)).toHaveText(
      `1 Tankstelle im Umkreis von 5 km um ${eiffelTower.label}`
    );
    expect(await geolocationCallCount(page)).toBe(0);

    await useOwnPosition(page);

    expect(await geolocationCallCount(page)).toBe(1);
    await expect(resultSummary(page)).toHaveText(
      '4 Tankstellen im Umkreis von 5 km um Dein Standort'
    );
    await expect(stationCards(page)).toHaveCount(4);
    await expect(stationCards(page)).toContainText([
      rueBailleulStation.distance,
      quaiDeLaRapeeStation.distance,
      boulevardDeLHopitalStation.distance,
      boulevardVincentAuriolStation.distance,
    ]);
    await expect(stationsMap(page).getByText('Du bist hier!', { exact: true })).toBeVisible();
    await expect(stationsMap(page).getByText(eiffelTower.label, { exact: true })).toHaveCount(0);
  });

  test('can be left while the map is still moving without script errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await page.goto('/settings');
    for (let round = 0; round < 3; round += 1) {
      await openExplore(page);
      await openSettings(page);
    }
    // Moving to the own position animates the map; the page is left in the middle of it.
    await openExplore(page);
    await page.getByRole('button', { name: 'Meinen Standort verwenden' }).click();
    await openSettings(page);
    // Selecting a station animates the map towards its price tag.
    await openExplore(page);
    await stationRowButton(stationCard(page, rueBailleulStation), rueBailleulStation).click();
    await openSettings(page);
    await expect(page.getByText('Radius: 5 km')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test.describe(() => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
    });

    test('the details link of a row opens the card of the station', async ({ page }) => {
      await stationCard(page, rueBailleulStation).getByRole('link').click();

      await expect(page).toHaveURL(`/stations/${rueBailleulStation.id}`);
      await expect(
        page.getByRole('article').getByRole('heading', { level: 2, name: rueBailleulStation.title })
      ).toBeVisible();
    });

    test('the fuel menu switches the fuel in place and remembers it', async ({ page }) => {
      await page.getByRole('button', { name: 'Kraftstoff: E5', exact: true }).click();
      const fuelMenu = page.getByRole('menu', { name: 'Kraftstoff' });
      await expect(fuelMenu.getByRole('menuitemradio', { name: 'Super E5' })).toHaveAttribute(
        'aria-checked',
        'true'
      );
      await fuelMenu.getByRole('menuitemradio', { name: 'LPG' }).click();

      await expect(fuelMenu).toBeHidden();
      await expect(page).toHaveURL('/');
      await expect(
        page.getByRole('button', { name: 'Kraftstoff: LPG', exact: true })
      ).toBeVisible();
      await useOwnPosition(page);
      await expect(stationCards(page)).toHaveCount(1);
      await expect(stationCard(page, boulevardVincentAuriolStation)).toContainText('0,984 €');

      await page.reload();
      await expect(
        page.getByRole('button', { name: 'Kraftstoff: LPG', exact: true })
      ).toBeVisible();
    });

    test('sorts by distance by default and by price on request', async ({ page }) => {
      await chooseFuel(page, 'Diesel');
      await openExplore(page);
      await useOwnPosition(page);
      await expect(stationCards(page)).toHaveCount(4);

      const byDistance = sortOptions(page).getByRole('radio', { name: 'Entfernung', exact: true });
      const byPrice = sortOptions(page).getByRole('radio', { name: 'Preis', exact: true });
      await expect(byDistance).toBeChecked();
      await expect(stationCards(page)).toContainText(['2,680 €', '2,391 €', '2,250 €', '2,250 €']);

      await byPrice.check();
      await expect(byDistance).not.toBeChecked();
      // Equal prices keep their distance order.
      await expect(stationCards(page)).toContainText([
        boulevardDeLHopitalStation.title,
        boulevardVincentAuriolStation.title,
        quaiDeLaRapeeStation.title,
        rueBailleulStation.title,
      ]);

      await byDistance.check();
      await expect(stationCards(page)).toContainText([
        rueBailleulStation.title,
        quaiDeLaRapeeStation.title,
        boulevardDeLHopitalStation.title,
        boulevardVincentAuriolStation.title,
      ]);
    });

    test('"Aktualisieren" fetches the prices again and shows the new ones', async ({ page }) => {
      await expect(stationCard(page, rueBailleulStation)).toContainText('2,540 €');
      // The recorded prices never change, so the refreshed answer carries a new price.
      await page.route(
        url => url.pathname === '/api/stations',
        async route => {
          const response = await route.fetch();
          const stations = z.array(refreshedStationSchema).parse(await response.json());
          await route.fulfill({
            response,
            json: stations.map(station =>
              station.id === rueBailleulStation.id
                ? { ...station, pricesInEuro: { ...station.pricesInEuro, e5: 2.499 } }
                : station
            ),
          });
        }
      );

      const stationsResponse = page.waitForResponse(
        response =>
          new URL(response.url()).pathname === '/api/stations' && response.status() === 200
      );
      await page.getByRole('button', { name: 'Aktualisieren', exact: true }).click();
      const requestUrl = new URL((await stationsResponse).url());

      expect(requestUrl.searchParams.get('fuel')).toBe('e5');
      expect(requestUrl.searchParams.get('radiusInKilometers')).toBe('5');
      expect(requestUrl.searchParams.get('latitude')).toBe(String(eiffelTower.latitude));
      expect(requestUrl.searchParams.get('longitude')).toBe(String(eiffelTower.longitude));
      await expect(stationCards(page)).toHaveCount(1);
      await expect(stationCard(page, rueBailleulStation)).toContainText('2,499 €');
    });

    test('marks the cheapest stations in list and map with text', async ({ page }) => {
      await expect(stationCard(page, rueBailleulStation)).toContainText('Günstigster Preis');
      await expect(
        stationsMap(page).getByRole('button', {
          name: `${rueBailleulStation.title}, 2,540 €, günstigster Preis`,
          exact: true,
        })
      ).toBeVisible();

      await chooseFuel(page, 'Diesel');
      await openExplore(page);
      await useOwnPosition(page);

      // Both stations in the 13th arrondissement sell Diesel for 2,250 €.
      await expect(stationCard(page, boulevardDeLHopitalStation)).toContainText(
        'Günstigster Preis'
      );
      await expect(stationCard(page, boulevardVincentAuriolStation)).toContainText(
        'Günstigster Preis'
      );
      await expect(stationCard(page, rueBailleulStation)).not.toContainText('Günstigster Preis');
      await expect(stationCard(page, quaiDeLaRapeeStation)).not.toContainText('Günstigster Preis');
      await expect(
        stationsMap(page).getByRole('button', {
          name: `${rueBailleulStation.title}, 2,680 €`,
          exact: true,
        })
      ).toBeVisible();
    });

    test('clicking a price tag on the map selects its station in the list', async ({ page }) => {
      const marker = stationsMap(page).getByRole('button', {
        name: `${rueBailleulStation.title}, 2,540 €, günstigster Preis`,
        exact: true,
      });
      const listButton = stationRowButton(
        stationCard(page, rueBailleulStation),
        rueBailleulStation
      );
      await expect(listButton).toHaveAttribute('aria-pressed', 'false');

      await marker.click();

      await expect(listButton).toHaveAttribute('aria-pressed', 'true');
      await expect(marker).toHaveAttribute('aria-pressed', 'true');
    });

    for (const key of ACTIVATION_KEYS) {
      test(`${key} on a focused price tag selects its station`, async ({ page }) => {
        const marker = stationsMap(page).getByRole('button', {
          name: `${rueBailleulStation.title}, 2,540 €, günstigster Preis`,
          exact: true,
        });
        const listButton = stationRowButton(
          stationCard(page, rueBailleulStation),
          rueBailleulStation
        );
        await expect(marker).toHaveAttribute('aria-pressed', 'false');

        await marker.focus();
        await expect(marker).toBeFocused();
        await page.keyboard.press(key);

        await expect(marker).toHaveAttribute('aria-pressed', 'true');
        await expect(listButton).toHaveAttribute('aria-pressed', 'true');
      });

      test(`${key} on a focused cluster zooms into it and focuses its cheapest station`, async ({
        page,
      }) => {
        await chooseFuel(page, 'Diesel');
        await openExplore(page);
        await useOwnPosition(page);

        const map = stationsMap(page);
        // At the zoom level of a 5 km radius the stations south-east of the center form a cluster.
        const cluster = map.getByRole('button', { name: '3 Tankstellen, ab 2,250 €', exact: true });
        // Of the two stations at 2,250 € the nearer one comes first.
        const cheapestMarker = map.getByRole('button', {
          name: `${boulevardDeLHopitalStation.title}, 2,250 €, günstigster Preis`,
          exact: true,
        });
        await expect(cheapestMarker).toHaveCount(0);
        // The clusters are drawn anew when a zoom ends, which would drop a focus taken earlier.
        await waitUntilSettled(cluster);

        await cluster.focus();
        await expect(cluster).toBeFocused();
        await page.keyboard.press(key);

        await expect(cluster).toHaveCount(0);
        await expect(cheapestMarker).toBeFocused();
        await expect(cheapestMarker).toHaveAttribute('aria-pressed', 'false');
      });
    }

    test('choosing a row opens the cluster of its station and keeps it selected', async ({
      page,
    }) => {
      await chooseFuel(page, 'Diesel');
      await openExplore(page);
      await useOwnPosition(page);

      const map = stationsMap(page);
      // At the zoom level of a 5 km radius the stations south-east of the center form a cluster.
      await expect(
        map.getByRole('button', { name: '3 Tankstellen, ab 2,250 €', exact: true })
      ).toBeVisible();
      const marker = map.getByRole('button', {
        name: `${boulevardDeLHopitalStation.title}, 2,250 €, günstigster Preis`,
        exact: true,
      });
      await expect(marker).toHaveCount(0);

      const listButton = stationRowButton(
        stationCard(page, boulevardDeLHopitalStation),
        boulevardDeLHopitalStation
      );
      await listButton.click();

      await expect(listButton).toHaveAttribute('aria-pressed', 'true');
      await expect(marker).toBeVisible();
      await expect(marker).toHaveAttribute('aria-pressed', 'true');
      await expect(
        stationRowButton(stationCard(page, rueBailleulStation), rueBailleulStation)
      ).toHaveAttribute('aria-pressed', 'false');

      await listButton.click();

      await expect(listButton).toHaveAttribute('aria-pressed', 'true');
      await expect(marker).toHaveAttribute('aria-pressed', 'true');
    });

    test('the place search moves the search to the chosen place', async ({ page }) => {
      const searchField = page.getByRole('combobox', { name: 'Ort suchen' });
      await expect(searchField).toHaveAttribute('placeholder', 'Position auf Karte');
      await searchField.pressSequentially('Bastille');
      const suggestions = page.getByRole('listbox', { name: 'Orte' }).getByRole('option');
      await expect(suggestions.first()).toContainText('Bastille');
      await suggestions.first().click();

      await expect(resultSummary(page)).toContainText('um Bastille');
      await expect(searchField).toHaveValue('Bastille');

      await page.getByRole('button', { name: 'Suche löschen' }).click();
      await expect(resultSummary(page)).toContainText('um die Kartenmitte');
      await expect(searchField).toHaveValue('');
    });

    test('"In diesem Bereich suchen" searches where the map was moved to', async ({ page }) => {
      await expect(resultSummary(page)).toContainText(`um ${eiffelTower.label}`);
      const areaSearch = page.getByRole('button', { name: 'In diesem Bereich suchen' });
      await expect(areaSearch).toBeHidden();

      // Towards the east, where the fixture stations are; an empty result would not name a center.
      await dragMapWithoutInertia(page, await lowerMiddleOfMap(page), { x: -250, y: 0 });

      await areaSearch.click();
      await expect(resultSummary(page)).toContainText('um die Kartenmitte');
      await expect(areaSearch).toBeHidden();
    });
  });
});

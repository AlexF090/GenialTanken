import type { Page } from '@playwright/test';
import {
  boulevardDeLHopitalStation,
  boulevardVincentAuriolStation,
  chooseFuel,
  eiffelTower,
  expect,
  favoriteButton,
  openExplore,
  openSettings,
  quaiDeLaRapeeStation,
  resultSummary,
  rueBailleulStation,
  showOnMapButton,
  stationCard,
  stationCards,
  stationsMap,
  test,
  useOwnPosition,
} from '../fixtures.js';

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

const sortOptions = (page: Page) => page.getByRole('group', { name: 'Sortierung', exact: true });

test.describe('explore page', () => {
  test('starts at the Eiffel Tower without asking for the own position', async ({ page }) => {
    await countGeolocationCalls(page);
    await page.goto('/');

    await expect(page).toHaveTitle('GenialTanken');
    await expect(page.getByRole('heading', { level: 1, name: 'GenialTanken' })).toBeVisible();
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

  test('a station title opens the detail page of the station', async ({ page }) => {
    await page.goto('/');

    await stationCard(page, rueBailleulStation).getByRole('link').click();

    await expect(page).toHaveURL(`/stations/${rueBailleulStation.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Details' })).toBeVisible();
    await expect(
      page.getByRole('article').getByRole('heading', { level: 2, name: rueBailleulStation.title })
    ).toBeVisible();
  });

  test('the fuel menu switches the fuel in place and remembers it', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Kraftstoff: E5', exact: true }).click();
    const fuelMenu = page.getByRole('menu', { name: 'Kraftstoff' });
    await expect(fuelMenu.getByRole('menuitemradio', { name: 'Super E5' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await fuelMenu.getByRole('menuitemradio', { name: 'LPG' }).click();

    await expect(fuelMenu).toBeHidden();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: 'Kraftstoff: LPG', exact: true })).toBeVisible();
    await useOwnPosition(page);
    await expect(stationCards(page)).toHaveCount(1);
    await expect(stationCard(page, boulevardVincentAuriolStation)).toContainText('0,984 €');

    await page.reload();
    await expect(page.getByRole('button', { name: 'Kraftstoff: LPG', exact: true })).toBeVisible();
  });

  test('sorts by distance by default and by price on request', async ({ page }) => {
    await page.goto('/');
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

  test('"Aktualisieren" fetches the prices again', async ({ page }) => {
    await page.goto('/');
    await expect(resultSummary(page)).toContainText(eiffelTower.label);

    const stationsRequest = page.waitForRequest(
      request => new URL(request.url()).pathname === '/api/stations'
    );
    await page.getByRole('button', { name: 'Aktualisieren', exact: true }).click();
    const requestUrl = new URL((await stationsRequest).url());

    expect(requestUrl.searchParams.get('fuel')).toBe('e5');
    expect(requestUrl.searchParams.get('radiusInKilometers')).toBe('5');
    expect(requestUrl.searchParams.get('latitude')).toBe(String(eiffelTower.latitude));
    expect(requestUrl.searchParams.get('longitude')).toBe(String(eiffelTower.longitude));
    await expect(stationCards(page)).toHaveCount(1);
    await expect(stationCard(page, rueBailleulStation)).toContainText('2,540 €');
  });

  test('marks the cheapest stations in list and map with text', async ({ page }) => {
    await page.goto('/');
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
    await expect(stationCard(page, boulevardDeLHopitalStation)).toContainText('Günstigster Preis');
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
    await page.goto('/');
    const marker = stationsMap(page).getByRole('button', {
      name: `${rueBailleulStation.title}, 2,540 €, günstigster Preis`,
      exact: true,
    });
    const listButton = showOnMapButton(stationCard(page, rueBailleulStation), rueBailleulStation);
    await expect(listButton).toHaveAttribute('aria-pressed', 'false');

    await marker.click();

    await expect(listButton).toHaveAttribute('aria-pressed', 'true');
    await expect(marker).toHaveAttribute('aria-pressed', 'true');
  });

  test('"Auf Karte zeigen" opens the cluster of a station and toggles the selection', async ({
    page,
  }) => {
    await page.goto('/');
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

    const listButton = showOnMapButton(
      stationCard(page, boulevardDeLHopitalStation),
      boulevardDeLHopitalStation
    );
    await listButton.click();

    await expect(listButton).toHaveAttribute('aria-pressed', 'true');
    await expect(marker).toBeVisible();
    await expect(marker).toHaveAttribute('aria-pressed', 'true');
    await expect(
      showOnMapButton(stationCard(page, rueBailleulStation), rueBailleulStation)
    ).toHaveAttribute('aria-pressed', 'false');

    await listButton.click();

    await expect(listButton).toHaveAttribute('aria-pressed', 'false');
    await expect(marker).toHaveAttribute('aria-pressed', 'false');
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
    await showOnMapButton(stationCard(page, rueBailleulStation), rueBailleulStation).click();
    await openSettings(page);
    await expect(page.getByText('Radius: 5 km')).toBeVisible();

    expect(errors).toEqual([]);
  });
});

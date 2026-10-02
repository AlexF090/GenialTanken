import {
  boulevardDeLHopitalStation,
  boulevardVincentAuriolStation,
  chooseFuel,
  expect,
  favoriteButton,
  openStationList,
  quaiDeLaRapeeStation,
  rueBailleulStation,
  stationCard,
  stationCards,
  test,
} from '../fixtures.js';

test.describe('station list', () => {
  test('lists the stations with an E5 price around the current position by default', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('GenialTanken');
    await expect(page.getByRole('heading', { level: 1, name: 'GenialTanken' })).toBeVisible();
    await expect(page.getByText('Kraftstoff: E5', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Preisdaten: prix-carburants.gouv.fr (öffnet in neuem Tab)' })
    ).toHaveAttribute('href', 'https://www.prix-carburants.gouv.fr/');

    // Only one fixture station sells E5 (sp95); the others are filtered out by the API.
    await expect(stationCards(page)).toHaveCount(1);
    await expect(page.getByText('Tankstellen werden geladen …')).toBeHidden();

    const card = stationCard(page, rueBailleulStation);
    await expect(card.getByRole('link')).toHaveAttribute(
      'href',
      `/stations/${rueBailleulStation.id}`
    );
    await expect(card).toContainText(rueBailleulStation.cityLine);
    await expect(card).toContainText('2,540 €');
    await expect(card).toContainText(rueBailleulStation.distance);
    await expect(favoriteButton(card, rueBailleulStation)).toHaveAttribute('aria-pressed', 'false');
  });

  test('a station card opens the detail page of the station', async ({ page }) => {
    await page.goto('/');

    await stationCard(page, rueBailleulStation).getByRole('link').click();

    await expect(page).toHaveURL(`/stations/${rueBailleulStation.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Details' })).toBeVisible();
    await expect(
      page.getByRole('article').getByRole('heading', { level: 2, name: rueBailleulStation.title })
    ).toBeVisible();
  });

  test('changing the fuel type refetches the stations', async ({ page }) => {
    await page.goto('/');
    await expect(stationCards(page)).toHaveCount(1);

    await chooseFuel(page, 'Diesel');
    await openStationList(page);

    await expect(page.getByText('Kraftstoff: Diesel', { exact: true })).toBeVisible();
    await expect(stationCards(page)).toHaveCount(4);
    await expect(stationCards(page)).toContainText([
      rueBailleulStation.title,
      quaiDeLaRapeeStation.title,
      boulevardDeLHopitalStation.title,
      boulevardVincentAuriolStation.title,
    ]);
    await expect(stationCards(page)).toContainText([
      rueBailleulStation.distance,
      quaiDeLaRapeeStation.distance,
      boulevardDeLHopitalStation.distance,
      boulevardVincentAuriolStation.distance,
    ]);
    await expect(stationCards(page)).toContainText(['2,680 €', '2,391 €', '2,250 €', '2,250 €']);

    await chooseFuel(page, 'LPG');
    await openStationList(page);

    await expect(stationCards(page)).toHaveCount(1);
    await expect(stationCard(page, boulevardVincentAuriolStation)).toContainText('0,984 €');
  });

  test('toggles between distance order and ascending price', async ({ page }) => {
    await page.goto('/');
    await chooseFuel(page, 'Diesel');
    await openStationList(page);
    await expect(stationCards(page)).toHaveCount(4);

    const sortButton = page.getByRole('button', { name: /^Sortiert nach:/ });
    await expect(sortButton).toHaveText('Sortiert nach: km');

    await sortButton.click();
    await expect(sortButton).toHaveText('Sortiert nach: Preis');
    // Equal prices keep their distance order.
    await expect(stationCards(page)).toContainText([
      boulevardDeLHopitalStation.title,
      boulevardVincentAuriolStation.title,
      quaiDeLaRapeeStation.title,
      rueBailleulStation.title,
    ]);

    await sortButton.click();
    await expect(sortButton).toHaveText('Sortiert nach: km');
    await expect(stationCards(page)).toContainText([
      rueBailleulStation.title,
      quaiDeLaRapeeStation.title,
      boulevardDeLHopitalStation.title,
      boulevardVincentAuriolStation.title,
    ]);
  });

  test('the reload button fetches the prices again', async ({ page }) => {
    await page.goto('/');
    await expect(stationCards(page)).toHaveCount(1);

    const stationsRequest = page.waitForRequest(
      request => new URL(request.url()).pathname === '/api/stations'
    );
    await page.getByRole('button', { name: 'Aktualisieren' }).click();
    const requestUrl = new URL((await stationsRequest).url());

    expect(requestUrl.searchParams.get('fuel')).toBe('e5');
    expect(requestUrl.searchParams.get('radiusInKilometers')).toBe('5');
    await expect(stationCards(page)).toHaveCount(1);
    await expect(stationCard(page, rueBailleulStation)).toContainText('2,540 €');
  });
});

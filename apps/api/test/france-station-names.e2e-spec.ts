import { stationsSchema } from '@genialtanken/contracts';
import {
  FRENCH_RECORDS_PATH,
  frenchStationPagePath,
} from '../src/fuel-price-providers/france/french-upstream-paths.js';
import { MAXIMUM_PARALLEL_UPSTREAM_REQUESTS } from '../src/upstream/maximum-parallel-upstream-requests.js';
import { useTestApplication } from './support/create-test-application.js';
import { useFakeUpstream } from './support/fake-upstream.js';
import {
  AUTOMATE_RECORD_ID,
  frenchRecords,
  frenchResponse,
  RAPEE_RECORD_ID,
  RAPEE_STATION_PAGE,
  RAPEE_STATION_PAGE_PATH,
  rapeeRecord,
} from './support/french-records.js';
import { PARIS } from './support/positions.js';

const PARIS_SEARCH = { ...PARIS, radiusInKilometers: '5', fuel: 'e10' };
const TIME_BUDGET_IN_MILLISECONDS = 200;
/** Far beyond the time budget, so even a slow machine answers well before a slow page would. */
const SLOW_PAGE_DELAY_IN_MILLISECONDS = 20_000;

const france = useFakeUpstream();
const stationPages = useFakeUpstream();
const startApplication = useTestApplication(() => ({
  FRANCE_FUEL_PRICES_BASE_URL: france.baseUrl,
  FRANCE_STATION_DETAILS_BASE_URL: stationPages.baseUrl,
  FRANCE_STATION_DETAILS_TIME_BUDGET_IN_MILLISECONDS: String(TIME_BUDGET_IN_MILLISECONDS),
}));

const namesOf = (body: unknown) => stationsSchema.parse(body).map(({ id, name }) => ({ id, name }));

const pageRequestsFor = (recordIdentifier: number) =>
  stationPages.requests.filter(
    recorded => recorded.url === frenchStationPagePath(recordIdentifier)
  );

beforeEach(() => {
  france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse(frenchRecords) });
  for (const record of frenchRecords) {
    stationPages.respondTo(frenchStationPagePath(record.id), { status: 404 });
  }
});

describe('French station names', () => {
  it('names stations after their page and leaves failed pages without name', async () => {
    stationPages.respondTo(RAPEE_STATION_PAGE_PATH, RAPEE_STATION_PAGE);
    stationPages.respondTo(frenchStationPagePath(AUTOMATE_RECORD_ID), { status: 500 });
    const api = await startApplication();

    const response = await api.get('/api/stations').query(PARIS_SEARCH).expect(200);
    await api.get('/api/stations').query(PARIS_SEARCH).expect(200);

    expect(
      stationsSchema.parse(response.body).map(({ id, brand, name }) => ({ id, brand, name }))
    ).toEqual([
      { id: 'fr-75012010', brand: 'TotalEnergies', name: 'RELAIS DE LA RAPEE' },
      { id: 'fr-75015001', brand: null, name: null },
    ]);
    expect(pageRequestsFor(RAPEE_RECORD_ID)).toHaveLength(1);
  });

  it('answers within the time budget and leaves a slow page without name', async () => {
    stationPages.respondTo(RAPEE_STATION_PAGE_PATH, {
      ...RAPEE_STATION_PAGE,
      delayInMilliseconds: SLOW_PAGE_DELAY_IN_MILLISECONDS,
    });
    const api = await startApplication();

    const startedAt = performance.now();
    const response = await api.get('/api/stations').query(PARIS_SEARCH).expect(200);
    const elapsedInMilliseconds = performance.now() - startedAt;

    expect(namesOf(response.body)).toContainEqual({ id: 'fr-75012010', name: null });
    expect(elapsedInMilliseconds).toBeGreaterThanOrEqual(TIME_BUDGET_IN_MILLISECONDS - 50);
    expect(elapsedInMilliseconds).toBeLessThan(SLOW_PAGE_DELAY_IN_MILLISECONDS / 2);
  });

  it('starts no further page requests once the time budget is spent', async () => {
    const manyRecords = Array.from(
      { length: MAXIMUM_PARALLEL_UPSTREAM_REQUESTS + 2 },
      (_unused, index) => ({ ...rapeeRecord, id: RAPEE_RECORD_ID + index })
    );
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse(manyRecords) });
    for (const record of manyRecords) {
      stationPages.respondTo(frenchStationPagePath(record.id), {
        ...RAPEE_STATION_PAGE,
        delayInMilliseconds: SLOW_PAGE_DELAY_IN_MILLISECONDS,
      });
    }
    const api = await startApplication();

    const response = await api.get('/api/stations').query(PARIS_SEARCH).expect(200);

    expect(namesOf(response.body).every(({ name }) => name === null)).toBe(true);
    expect(stationPages.requests).toHaveLength(MAXIMUM_PARALLEL_UPSTREAM_REQUESTS);
  });

  it('asks again for a page that missed the time budget', async () => {
    stationPages.respondTo(RAPEE_STATION_PAGE_PATH, {
      ...RAPEE_STATION_PAGE,
      delayInMilliseconds: SLOW_PAGE_DELAY_IN_MILLISECONDS,
    });
    const api = await startApplication();
    await api.get('/api/stations').query(PARIS_SEARCH).expect(200);

    stationPages.respondTo(RAPEE_STATION_PAGE_PATH, RAPEE_STATION_PAGE);
    const response = await api.get('/api/stations').query(PARIS_SEARCH).expect(200);

    expect(namesOf(response.body)).toContainEqual({
      id: 'fr-75012010',
      name: 'RELAIS DE LA RAPEE',
    });
    expect(pageRequestsFor(RAPEE_RECORD_ID)).toHaveLength(2);
  });

  it.each([
    ['is missing', { status: 404 }],
    ['fails', { status: 500 }],
  ])('does not ask again soon for a page that %s', async (_description, fakeResponse) => {
    stationPages.respondTo(RAPEE_STATION_PAGE_PATH, RAPEE_STATION_PAGE);
    stationPages.respondTo(frenchStationPagePath(AUTOMATE_RECORD_ID), fakeResponse);
    const api = await startApplication();

    await api.get('/api/stations').query(PARIS_SEARCH).expect(200);
    const response = await api.get('/api/stations').query(PARIS_SEARCH).expect(200);

    expect(namesOf(response.body)).toEqual([
      { id: 'fr-75012010', name: 'RELAIS DE LA RAPEE' },
      { id: 'fr-75015001', name: null },
    ]);
    expect(pageRequestsFor(AUTOMATE_RECORD_ID)).toHaveLength(1);
  });
});

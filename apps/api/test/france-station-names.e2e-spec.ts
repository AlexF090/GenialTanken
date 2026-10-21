import { stationsSchema } from '@genialtanken/contracts';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApplication } from './support/create-test-application.js';
import type { EnvironmentOverrides } from './support/create-test-application.js';
import { FakeUpstream } from './support/fake-upstream.js';
import {
  AUTOMATE_RECORD_ID,
  FRENCH_RECORDS_PATH,
  frenchRecords,
  frenchResponse,
  RAPEE_RECORD_ID,
  rapeeDetailRecord,
} from './support/french-records.js';

const PARIS_SEARCH = {
  latitude: '48.8566',
  longitude: '2.3522',
  radiusInKilometers: '5',
  fuel: 'e10',
};
const TIME_BUDGET_IN_MILLISECONDS = 200;
const SLOW_PAGE_DELAY_IN_MILLISECONDS = 3000;
/** Local answers take a few milliseconds; this stays far below the slow page delay. */
const ALLOWED_OVERRUN_IN_MILLISECONDS = 800;
/** Pages fetched at once by the French provider. */
const MAXIMUM_PARALLEL_STATION_DETAILS_REQUESTS = 8;

const RAPEE_PAGE = {
  status: 200,
  body: '<h3 class="fr-text--md">RELAIS DE LA RAPEE</h3><p><strong>TotalEnergies</strong><br />Quai de la Rapée</p>',
};

const stationPagePath = (recordIdentifier: number) =>
  `/map/recuperer_infos_pdv/${String(recordIdentifier)}`;

let france: FakeUpstream;
let stationPages: FakeUpstream;
let application: NestExpressApplication | undefined;

const startApplication = async (overrides: EnvironmentOverrides = {}) => {
  application = await createTestApplication({
    FRANCE_FUEL_PRICES_BASE_URL: france.baseUrl,
    FRANCE_STATION_DETAILS_BASE_URL: stationPages.baseUrl,
    FRANCE_STATION_DETAILS_TIME_BUDGET_IN_MILLISECONDS: String(TIME_BUDGET_IN_MILLISECONDS),
    ...overrides,
  });
  return request(application.getHttpServer());
};

const namesOf = (body: unknown) => stationsSchema.parse(body).map(({ id, name }) => ({ id, name }));

const pageRequestsFor = (recordIdentifier: number) =>
  stationPages.requests.filter(recorded => recorded.url === stationPagePath(recordIdentifier));

beforeEach(async () => {
  [france, stationPages] = await Promise.all([FakeUpstream.start(), FakeUpstream.start()]);
  france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse(frenchRecords) });
});

afterEach(async () => {
  await application?.close();
  application = undefined;
  await Promise.all([france.stop(), stationPages.stop()]);
});

describe('French station names', () => {
  it('answers within the time budget and leaves a slow page without name', async () => {
    stationPages.respondTo(stationPagePath(RAPEE_RECORD_ID), {
      ...RAPEE_PAGE,
      delayInMilliseconds: SLOW_PAGE_DELAY_IN_MILLISECONDS,
    });
    const api = await startApplication();

    const startedAt = performance.now();
    const response = await api.get('/api/stations').query(PARIS_SEARCH).expect(200);
    const elapsedInMilliseconds = performance.now() - startedAt;

    expect(namesOf(response.body)).toContainEqual({ id: 'fr-75012010', name: null });
    expect(elapsedInMilliseconds).toBeGreaterThanOrEqual(TIME_BUDGET_IN_MILLISECONDS - 50);
    expect(elapsedInMilliseconds).toBeLessThan(
      TIME_BUDGET_IN_MILLISECONDS + ALLOWED_OVERRUN_IN_MILLISECONDS
    );
  });

  it('starts no further page requests once the time budget is spent', async () => {
    const manyRecords = Array.from(
      { length: MAXIMUM_PARALLEL_STATION_DETAILS_REQUESTS + 2 },
      (_unused, index) => ({ ...rapeeDetailRecord, id: RAPEE_RECORD_ID + index })
    );
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse(manyRecords) });
    for (const record of manyRecords) {
      stationPages.respondTo(stationPagePath(record.id), {
        ...RAPEE_PAGE,
        delayInMilliseconds: SLOW_PAGE_DELAY_IN_MILLISECONDS,
      });
    }
    const api = await startApplication();

    const response = await api.get('/api/stations').query(PARIS_SEARCH).expect(200);

    expect(namesOf(response.body).every(({ name }) => name === null)).toBe(true);
    expect(stationPages.requests).toHaveLength(MAXIMUM_PARALLEL_STATION_DETAILS_REQUESTS);
  });

  it('asks again for a page that missed the time budget', async () => {
    stationPages.respondTo(stationPagePath(RAPEE_RECORD_ID), {
      ...RAPEE_PAGE,
      delayInMilliseconds: SLOW_PAGE_DELAY_IN_MILLISECONDS,
    });
    const api = await startApplication();
    await api.get('/api/stations').query(PARIS_SEARCH).expect(200);

    stationPages.respondTo(stationPagePath(RAPEE_RECORD_ID), RAPEE_PAGE);
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
    stationPages.respondTo(stationPagePath(RAPEE_RECORD_ID), RAPEE_PAGE);
    stationPages.respondTo(stationPagePath(AUTOMATE_RECORD_ID), fakeResponse);
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

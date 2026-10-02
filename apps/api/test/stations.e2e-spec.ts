import { apiErrorSchema, stationsSchema } from '@genialtanken/contracts';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApplication, GERMAN_TEST_API_KEY } from './support/create-test-application.js';
import type { EnvironmentOverrides } from './support/create-test-application.js';
import { FakeUpstream } from './support/fake-upstream.js';
import type { RecordedRequest } from './support/fake-upstream.js';
import {
  AUTOMATE_RECORD_ID,
  FRENCH_RECORDS_PATH,
  frenchRecords,
  OUTSIDE_RADIUS_RECORD_ID,
  frenchResponse,
  RAPEE_RECORD_ID,
  rapeeDetailRecord,
} from './support/french-records.js';
import {
  ARAL_STATION_ID,
  GERMAN_STATIONS_PATH,
  germanStations,
  SHELL_STATION_ID,
} from './support/german-stations.js';

const strictApiErrorSchema = apiErrorSchema.strict();

const UNAVAILABLE_BODY = { statusCode: 502, message: 'The fuel price service is unavailable.' };
const NOT_FOUND_BODY = { statusCode: 404, message: 'The station was not found.' };

const PARIS = { latitude: '48.8566', longitude: '2.3522' };
const KASSEL = { latitude: '51.3127', longitude: '9.4797' };

const REGULAR_DAY = [{ opening: '05:00', closing: '23:00' }];
const ALL_DAY = [{ opening: '00:00', closing: '24:00' }];

const EXPECTED_RAPEE_STATION = {
  id: 'fr-75012010',
  country: 'FR',
  name: null,
  brand: null,
  address: {
    street: '36 Quai de la Rapée',
    houseNumber: null,
    postalCode: '75012',
    city: 'Paris',
    latitude: 48.842,
    longitude: 2.373,
  },
  pricesInEuro: { e5: null, e10: 2.152, superPlus: 2.286, diesel: 2.391, e85: null, lpg: null },
  isOpen: null,
  openingTimes: {
    monday: [
      { opening: '06:00', closing: '12:00' },
      { opening: '14:00', closing: '20:30' },
    ],
    tuesday: REGULAR_DAY,
    wednesday: REGULAR_DAY,
    thursday: REGULAR_DAY,
    friday: REGULAR_DAY,
    saturday: REGULAR_DAY,
    sunday: [],
    publicHoliday: [],
  },
  distanceInMeters: 2225,
};

const GERMAN_OPENING_DAY = [{ opening: '06:00', closing: '22:00' }];

const EXPECTED_ARAL_STATION = {
  id: `de-${ARAL_STATION_ID}`,
  country: 'DE',
  name: 'Aral Tankstelle Wilhelmshöhe',
  brand: 'Aral',
  address: {
    street: 'Wilhelmshöher Allee',
    houseNumber: '100',
    postalCode: '34119',
    city: 'Kassel',
    latitude: 51.315,
    longitude: 9.47,
  },
  pricesInEuro: { e5: 1.859, e10: null, superPlus: null, diesel: 1.689, e85: null, lpg: null },
  isOpen: true,
  openingTimes: {
    monday: GERMAN_OPENING_DAY,
    tuesday: GERMAN_OPENING_DAY,
    wednesday: GERMAN_OPENING_DAY,
    thursday: GERMAN_OPENING_DAY,
    friday: GERMAN_OPENING_DAY,
    saturday: GERMAN_OPENING_DAY,
    sunday: [],
    publicHoliday: [],
  },
  distanceInMeters: 721,
};

/** The Shell station moved to about 930 m from the Paris test position. */
const germanStationsNearParis = germanStations.map(station =>
  station.id === SHELL_STATION_ID
    ? { ...station, address: { ...station.address, latitude: 48.85, longitude: 2.36 } }
    : station
);

const searchParametersOf = (recordedRequest: RecordedRequest | undefined): URLSearchParams =>
  new URL(recordedRequest?.url ?? '/', 'http://fake-upstream').searchParams;

const idsOf = (body: unknown): string[] => stationsSchema.parse(body).map(station => station.id);

let france: FakeUpstream;
let germany: FakeUpstream;
let application: NestExpressApplication | undefined;

const startApplication = async (overrides: EnvironmentOverrides = {}) => {
  application = await createTestApplication({
    FRANCE_FUEL_PRICES_BASE_URL: france.baseUrl,
    TANKENTANKEN_BASE_URL: germany.baseUrl,
    ...overrides,
  });
  return request(application.getHttpServer());
};

const startWithGermany = async (overrides: EnvironmentOverrides = {}) =>
  startApplication({ TANKENTANKEN_API_KEY: GERMAN_TEST_API_KEY, ...overrides });

beforeEach(async () => {
  [france, germany] = await Promise.all([FakeUpstream.start(), FakeUpstream.start()]);
});

afterEach(async () => {
  await application?.close();
  application = undefined;
  await Promise.all([france.stop(), germany.stop()]);
});

describe('GET /api/stations with French open data only', () => {
  it('maps the French records selling the requested fuel, nearest first', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse(frenchRecords) });
    const api = await startApplication();

    const response = await api
      .get('/api/stations')
      .query({ ...PARIS, radiusInKilometers: '5', fuel: 'e10' })
      .expect(200);

    expect(response.body).toEqual([
      EXPECTED_RAPEE_STATION,
      {
        ...EXPECTED_RAPEE_STATION,
        id: 'fr-75015001',
        address: {
          ...EXPECTED_RAPEE_STATION.address,
          street: '12 Rue de Vaugirard',
          postalCode: '75015',
          latitude: 48.84,
          longitude: 2.3,
        },
        pricesInEuro: {
          e5: 2.149,
          e10: 2.099,
          superPlus: null,
          diesel: null,
          e85: null,
          lpg: null,
        },
        openingTimes: {
          monday: ALL_DAY,
          tuesday: ALL_DAY,
          wednesday: ALL_DAY,
          thursday: ALL_DAY,
          friday: ALL_DAY,
          saturday: ALL_DAY,
          sunday: ALL_DAY,
          publicHoliday: [],
        },
        distanceInMeters: 4242,
      },
    ]);
  });

  it('includes stations up to the exact requested radius', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse(frenchRecords) });
    const api = await startApplication();

    const response = await api
      .get('/api/stations')
      .query({ ...PARIS, radiusInKilometers: '5.01', fuel: 'e10' })
      .expect(200);

    expect(
      stationsSchema.parse(response.body).map(({ id, distanceInMeters }) => [id, distanceInMeters])
    ).toEqual([
      ['fr-75012010', 2225],
      ['fr-75015001', 4242],
      [`fr-${String(OUTSIDE_RADIUS_RECORD_ID)}`, 5004],
    ]);
  });

  it('asks the French API for stations around the position, nearest first', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse([]) });
    const api = await startApplication();

    await api
      .get('/api/stations')
      .query({ ...PARIS, radiusInKilometers: '7.5', fuel: 'superPlus' })
      .expect(200);

    expect(france.requests).toHaveLength(1);
    const parameters = searchParametersOf(france.requests[0]);
    expect(parameters.get('where')).toBe(
      "within_distance(geom, geom'POINT(2.352 48.857)', 7.5km) and sp98_prix is not null"
    );
    expect(parameters.get('order_by')).toBe("distance(geom, geom'POINT(2.352 48.857)')");
    expect(parameters.get('limit')).toBe('100');
  });

  it('defaults to a 5 km radius and E5', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse([]) });
    const api = await startApplication();

    await api.get('/api/stations').query(PARIS).expect(200);

    expect(searchParametersOf(france.requests[0]).get('where')).toBe(
      "within_distance(geom, geom'POINT(2.352 48.857)', 5km) and sp95_prix is not null"
    );
  });

  it('does not call the German provider without an API key', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse(frenchRecords) });
    const api = await startApplication();

    await api.get('/api/stations').query(PARIS).expect(200);

    expect(germany.requests).toHaveLength(0);
  });

  it.each([
    ['a missing position', {}, 'latitude'],
    ['a radius above 25 km', { ...PARIS, radiusInKilometers: '26' }, 'radiusInKilometers'],
    ['an unknown fuel', { ...PARIS, fuel: 'kerosene' }, 'fuel'],
    ['a non-numeric longitude', { latitude: '48.8', longitude: 'east' }, 'longitude'],
  ])('rejects %s with 400', async (_description, query, invalidField) => {
    const api = await startApplication();

    const response = await api.get('/api/stations').query(query).expect(400);

    const apiError = strictApiErrorSchema.parse(response.body);
    expect(apiError.statusCode).toBe(400);
    expect(apiError.message).toContain(invalidField);
    expect(france.requests).toHaveLength(0);
  });

  it('responds with 502 when the French API returns an unexpected payload', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: { error: 'quota exceeded' } });
    const api = await startApplication();

    const response = await api.get('/api/stations').query(PARIS).expect(502);

    expect(response.body).toEqual(UNAVAILABLE_BODY);
  });

  it('skips single malformed records', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, {
      status: 200,
      body: frenchResponse([{ id: 'broken' }, ...frenchRecords]),
    });
    const api = await startApplication();

    const response = await api
      .get('/api/stations')
      .query({ ...PARIS, fuel: 'e10' })
      .expect(200);

    expect(idsOf(response.body)).toEqual(['fr-75012010', 'fr-75015001']);
  });

  it('responds with 502 when the French API does not answer in time', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, {
      status: 200,
      body: frenchResponse(frenchRecords),
      delayInMilliseconds: 2000,
    });
    const api = await startApplication({ UPSTREAM_TIMEOUT_IN_MILLISECONDS: '100' });

    const response = await api.get('/api/stations').query(PARIS).expect(502);

    expect(response.body).toEqual(UNAVAILABLE_BODY);
  });

  it('serves a repeated request from the cache', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse(frenchRecords) });
    const api = await startApplication();
    const query = { ...PARIS, fuel: 'e10' };

    await api.get('/api/stations').query(query).expect(200);
    const response = await api.get('/api/stations').query(query).expect(200);

    expect(france.requests).toHaveLength(1);
    expect(idsOf(response.body)).toEqual(['fr-75012010', 'fr-75015001']);
  });

  it('does not cache failures', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 503 });
    const api = await startApplication();

    await api.get('/api/stations').query(PARIS).expect(502);
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse(frenchRecords) });
    await api.get('/api/stations').query(PARIS).expect(200);

    expect(france.requests).toHaveLength(2);
  });
});

describe('GET /api/stations with French and German data', () => {
  it('merges both providers sorted by distance', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse(frenchRecords) });
    germany.respondTo(GERMAN_STATIONS_PATH, { status: 200, body: germanStationsNearParis });
    const api = await startWithGermany();

    const response = await api
      .get('/api/stations')
      .query({ ...PARIS, fuel: 'e10' })
      .expect(200);

    expect(
      stationsSchema.parse(response.body).map(({ id, distanceInMeters }) => [id, distanceInMeters])
    ).toEqual([
      [`de-${SHELL_STATION_ID}`, 930],
      ['fr-75012010', 2225],
      ['fr-75015001', 4242],
    ]);
  });

  it('maps German stations', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse([]) });
    germany.respondTo(GERMAN_STATIONS_PATH, { status: 200, body: germanStations });
    const api = await startWithGermany();

    const response = await api
      .get('/api/stations')
      .query({ ...KASSEL, fuel: 'e5' })
      .expect(200);

    expect(stationsSchema.parse(response.body)[0]).toEqual(EXPECTED_ARAL_STATION);
  });

  it('asks the German API around the rounded position for the radius in meters with the API key', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse([]) });
    germany.respondTo(GERMAN_STATIONS_PATH, { status: 200, body: [] });
    const api = await startWithGermany();

    await api
      .get('/api/stations')
      .query({ latitude: '51.3127', longitude: '9.4797', radiusInKilometers: '10' })
      .expect(200);

    expect(germany.requests).toHaveLength(1);
    expect(germany.requests[0]?.url).toBe(
      '/gas-stations?latitude=51.313&longitude=9.48&radius=10000'
    );
    expect(germany.requests[0]?.headers.authorization).toBe(`Bearer ${GERMAN_TEST_API_KEY}`);
  });

  it('does not ask the German API for a fuel it does not offer', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse(frenchRecords) });
    const api = await startWithGermany();

    const response = await api
      .get('/api/stations')
      .query({ ...PARIS, fuel: 'superPlus' })
      .expect(200);

    expect(germany.requests).toHaveLength(0);
    expect(idsOf(response.body)).toEqual(['fr-75011002', 'fr-75012010']);
  });

  it('returns the French stations when the German API fails', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse(frenchRecords) });
    germany.respondTo(GERMAN_STATIONS_PATH, { status: 500 });
    const api = await startWithGermany();

    const response = await api
      .get('/api/stations')
      .query({ ...PARIS, fuel: 'e10' })
      .expect(200);

    expect(idsOf(response.body)).toEqual(['fr-75012010', 'fr-75015001']);
  });

  it('returns the German stations when the French API fails', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 500 });
    germany.respondTo(GERMAN_STATIONS_PATH, { status: 200, body: germanStationsNearParis });
    const api = await startWithGermany();

    const response = await api
      .get('/api/stations')
      .query({ ...PARIS, fuel: 'e10' })
      .expect(200);

    expect(idsOf(response.body)).toEqual([`de-${SHELL_STATION_ID}`]);
  });

  it('responds with 502 when all providers fail', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 500 });
    germany.respondTo(GERMAN_STATIONS_PATH, { status: 200, body: [{ id: 'incomplete' }] });
    const api = await startWithGermany();

    const response = await api.get('/api/stations').query(PARIS).expect(502);

    expect(response.body).toEqual(UNAVAILABLE_BODY);
  });

  it('caps the response at 100 stations', async () => {
    // Stations line up due north, alternating German (even) and French (odd) steps of 0.001°
    const latitudeAt = (step: number) => 48.8566 + step * 0.001;
    const manyFrenchRecords = Array.from({ length: 60 }, (_, index) => ({
      ...frenchRecords[0],
      id: 1000 + index,
      geom: { lon: 2.3522, lat: latitudeAt(index * 2 + 1) },
    }));
    const [germanTemplate] = germanStations;
    if (germanTemplate === undefined) {
      throw new Error('The German station fixture is empty.');
    }
    const manyGermanStations = Array.from({ length: 60 }, (_, index) => ({
      ...germanTemplate,
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      address: { ...germanTemplate.address, latitude: latitudeAt(index * 2), longitude: 2.3522 },
    }));
    france.respondTo(FRENCH_RECORDS_PATH, {
      status: 200,
      body: frenchResponse(manyFrenchRecords),
    });
    germany.respondTo(GERMAN_STATIONS_PATH, { status: 200, body: manyGermanStations });
    const api = await startWithGermany();

    const response = await api
      .get('/api/stations')
      .query({ ...PARIS, radiusInKilometers: '25', fuel: 'diesel' })
      .expect(200);

    const ids = idsOf(response.body);
    expect(ids).toHaveLength(100);
    expect(ids[0]).toBe('de-00000000-0000-4000-8000-000000000000');
    expect(ids.at(-1)).toBe('fr-1049');
  });

  it('shares one German request between nearby positions, with exact distances', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse([]) });
    germany.respondTo(GERMAN_STATIONS_PATH, { status: 200, body: germanStations });
    const api = await startWithGermany();

    const first = await api
      .get('/api/stations')
      .query({ latitude: '51.3127', longitude: '9.4797', fuel: 'e5' })
      .expect(200);
    const second = await api
      .get('/api/stations')
      .query({ latitude: '51.3131', longitude: '9.4803', fuel: 'e5' })
      .expect(200);

    expect(germany.requests).toHaveLength(1);
    expect(stationsSchema.parse(first.body)[0]?.distanceInMeters).toBe(721);
    expect(stationsSchema.parse(second.body)[0]?.distanceInMeters).not.toBe(721);
  });

  it('caches both providers', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse(frenchRecords) });
    germany.respondTo(GERMAN_STATIONS_PATH, { status: 200, body: germanStations });
    const api = await startWithGermany();

    await api.get('/api/stations').query(PARIS).expect(200);
    await api.get('/api/stations').query(PARIS).expect(200);

    expect(france.requests).toHaveLength(1);
    expect(germany.requests).toHaveLength(1);
  });
});

describe('GET /api/stations/:id', () => {
  it('returns a French station without distance', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, {
      status: 200,
      body: frenchResponse([rapeeDetailRecord]),
    });
    const api = await startApplication();

    const response = await api.get(`/api/stations/fr-${String(RAPEE_RECORD_ID)}`).expect(200);

    expect(response.body).toEqual({ ...EXPECTED_RAPEE_STATION, distanceInMeters: null });
    expect(searchParametersOf(france.requests[0]).get('where')).toBe('id=75012010');
  });

  it('responds with 404 when the French API does not know the station', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse([]) });
    const api = await startApplication();

    const response = await api.get(`/api/stations/fr-${String(AUTOMATE_RECORD_ID)}`).expect(404);

    expect(response.body).toEqual(NOT_FOUND_BODY);
  });

  it('responds with 404 for a French identifier that is not a number', async () => {
    const api = await startApplication();

    const response = await api.get('/api/stations/fr-abc').expect(404);

    expect(response.body).toEqual(NOT_FOUND_BODY);
    expect(france.requests).toHaveLength(0);
  });

  it('responds with 502 when the French API fails', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 500 });
    const api = await startApplication();

    const response = await api.get(`/api/stations/fr-${String(RAPEE_RECORD_ID)}`).expect(502);

    expect(response.body).toEqual(UNAVAILABLE_BODY);
  });

  it('returns a German station without distance', async () => {
    const { distance: _distance, ...aralDetail } = germanStations[0] ?? {};
    germany.respondTo(`${GERMAN_STATIONS_PATH}/${ARAL_STATION_ID}`, {
      status: 200,
      body: aralDetail,
    });
    const api = await startWithGermany();

    const response = await api.get(`/api/stations/de-${ARAL_STATION_ID}`).expect(200);

    expect(response.body).toEqual({ ...EXPECTED_ARAL_STATION, distanceInMeters: null });
    expect(germany.requests[0]?.headers.authorization).toBe(`Bearer ${GERMAN_TEST_API_KEY}`);
  });

  it('responds with 404 when the German API does not know the station', async () => {
    germany.respondTo(`${GERMAN_STATIONS_PATH}/${ARAL_STATION_ID}`, { status: 404 });
    const api = await startWithGermany();

    const response = await api.get(`/api/stations/de-${ARAL_STATION_ID}`).expect(404);

    expect(response.body).toEqual(NOT_FOUND_BODY);
  });

  it('responds with 404 for a German station while the German provider is disabled', async () => {
    const api = await startApplication();

    const response = await api.get(`/api/stations/de-${ARAL_STATION_ID}`).expect(404);

    expect(response.body).toEqual(NOT_FOUND_BODY);
    expect(germany.requests).toHaveLength(0);
  });

  it('responds with 404 for an unknown country prefix', async () => {
    const api = await startWithGermany();

    const response = await api.get('/api/stations/it-12345').expect(404);

    expect(response.body).toEqual(NOT_FOUND_BODY);
  });

  it.each(['12345', 'fr_12345', 'FR-12345', 'fr-'])(
    'rejects the malformed identifier %s with 400',
    async identifier => {
      const api = await startApplication();

      const response = await api.get(`/api/stations/${identifier}`).expect(400);

      expect(strictApiErrorSchema.parse(response.body).statusCode).toBe(400);
      expect(france.requests).toHaveLength(0);
    }
  );
});

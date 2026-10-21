import {
  apiErrorSchema,
  MAXIMUM_STATION_IDENTIFIERS_PER_REQUEST,
  stationLookupSchema,
  stationsSchema,
} from '@genialtanken/contracts';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApplication } from './support/create-test-application.js';
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

const strictApiErrorSchema = apiErrorSchema.strict();

const UNAVAILABLE_BODY = { statusCode: 502, message: 'The fuel price service is unavailable.' };
const NOT_FOUND_BODY = { statusCode: 404, message: 'The station was not found.' };

const PARIS = { latitude: '48.8566', longitude: '2.3522' };

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

const searchParametersOf = (recordedRequest: RecordedRequest | undefined): URLSearchParams =>
  new URL(recordedRequest?.url ?? '/', 'http://fake-upstream').searchParams;

const idsOf = (body: unknown): string[] => stationsSchema.parse(body).map(station => station.id);

let france: FakeUpstream;
let application: NestExpressApplication | undefined;

const startApplication = async (overrides: EnvironmentOverrides = {}) => {
  application = await createTestApplication({
    FRANCE_FUEL_PRICES_BASE_URL: france.baseUrl,
    ...overrides,
  });
  return request(application.getHttpServer());
};

beforeEach(async () => {
  france = await FakeUpstream.start();
});

afterEach(async () => {
  await application?.close();
  application = undefined;
  await france.stop();
});

describe('GET /api/stations', () => {
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

  it('names French stations after their page on the price website, without for failed pages', async () => {
    const stationPages = await FakeUpstream.start();
    try {
      france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse(frenchRecords) });
      stationPages.respondTo(`/map/recuperer_infos_pdv/${String(RAPEE_RECORD_ID)}`, {
        status: 200,
        body: '<h3 class="fr-text--md">RELAIS DE LA RAPEE</h3><p><strong>TotalEnergies</strong><br />Quai de la Rapée</p>',
      });
      stationPages.respondTo(`/map/recuperer_infos_pdv/${String(AUTOMATE_RECORD_ID)}`, {
        status: 500,
      });
      const api = await startApplication({ FRANCE_STATION_DETAILS_BASE_URL: stationPages.baseUrl });

      const response = await api
        .get('/api/stations')
        .query({ ...PARIS, radiusInKilometers: '5', fuel: 'e10' })
        .expect(200);

      const stations = stationsSchema.parse(response.body);
      expect(stations.map(({ id, brand, name }) => ({ id, brand, name }))).toEqual([
        { id: 'fr-75012010', brand: 'TotalEnergies', name: 'RELAIS DE LA RAPEE' },
        { id: 'fr-75015001', brand: null, name: null },
      ]);

      await api.get('/api/stations').query({ ...PARIS, radiusInKilometers: '5', fuel: 'e10' });
      const rapeePageRequests = stationPages.requests.filter(recorded =>
        recorded.url.endsWith(String(RAPEE_RECORD_ID))
      );
      expect(rapeePageRequests).toHaveLength(1);
    } finally {
      await stationPages.stop();
    }
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

  it.each([
    ['a missing position', {}, 'latitude'],
    ['a radius above 30 km', { ...PARIS, radiusInKilometers: '31' }, 'radiusInKilometers'],
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

describe('GET /api/stations response size', () => {
  it('caps the response at the 100 nearest stations', async () => {
    // Stations line up due north in steps of 0.001°
    const manyFrenchRecords = Array.from({ length: 120 }, (_, index) => ({
      ...frenchRecords[0],
      id: 1000 + index,
      geom: { lon: 2.3522, lat: 48.8566 + (index + 1) * 0.001 },
    }));
    france.respondTo(FRENCH_RECORDS_PATH, {
      status: 200,
      body: frenchResponse(manyFrenchRecords),
    });
    const api = await startApplication();

    const response = await api
      .get('/api/stations')
      .query({ ...PARIS, radiusInKilometers: '25', fuel: 'diesel' })
      .expect(200);

    const ids = idsOf(response.body);
    expect(ids).toHaveLength(100);
    expect(ids[0]).toBe('fr-1000');
    expect(ids.at(-1)).toBe('fr-1099');
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

  it.each(['it-12345', 'de-005056ba-7cb6'])(
    'responds with 404 for the country prefix without provider in %s',
    async identifier => {
      const api = await startApplication();

      const response = await api.get(`/api/stations/${identifier}`).expect(404);

      expect(response.body).toEqual(NOT_FOUND_BODY);
      expect(france.requests).toHaveLength(0);
    }
  );

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

describe('GET /api/stations/by-identifiers', () => {
  const LOOKUP_PATH = '/api/stations/by-identifiers';
  const RAPEE_IDENTIFIER = `fr-${String(RAPEE_RECORD_ID)}`;
  const UNKNOWN_COUNTRY_IDENTIFIER = 'it-12345';

  it('returns the found stations and lists the others as unavailable, in the requested order', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, {
      status: 200,
      body: frenchResponse([rapeeDetailRecord]),
    });
    const api = await startApplication();

    const response = await api
      .get(LOOKUP_PATH)
      .query({
        identifiers: ['fr-abc', UNKNOWN_COUNTRY_IDENTIFIER, RAPEE_IDENTIFIER].join(','),
      })
      .expect(200);

    expect(response.body).toEqual({
      stations: [{ ...EXPECTED_RAPEE_STATION, distanceInMeters: null }],
      unavailableIdentifiers: ['fr-abc', UNKNOWN_COUNTRY_IDENTIFIER],
      failedIdentifiers: [],
    });
    expect(france.requests).toHaveLength(1);
  });

  it('lists the identifiers of a failing provider as failed and still answers', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 500 });
    const api = await startApplication();

    const response = await api
      .get(LOOKUP_PATH)
      .query({ identifiers: `${RAPEE_IDENTIFIER},${UNKNOWN_COUNTRY_IDENTIFIER}` })
      .expect(200);

    expect(stationLookupSchema.parse(response.body)).toEqual({
      stations: [],
      unavailableIdentifiers: [UNKNOWN_COUNTRY_IDENTIFIER],
      failedIdentifiers: [RAPEE_IDENTIFIER],
    });
  });

  it('responds with 502 when every lookup fails', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 500 });
    const api = await startApplication();

    const response = await api
      .get(LOOKUP_PATH)
      .query({ identifiers: RAPEE_IDENTIFIER })
      .expect(502);

    expect(response.body).toEqual(UNAVAILABLE_BODY);
  });

  it('answers with a lookup instead of treating by-identifiers as a station identifier', async () => {
    const api = await startApplication();

    const response = await api.get(LOOKUP_PATH).query({ identifiers: 'fr-abc' }).expect(200);

    expect(response.body).toEqual({
      stations: [],
      unavailableIdentifiers: ['fr-abc'],
      failedIdentifiers: [],
    });
  });

  it.each([
    ['a missing parameter', {}],
    [
      `more than ${String(MAXIMUM_STATION_IDENTIFIERS_PER_REQUEST)} identifiers`,
      {
        identifiers: Array.from(
          { length: MAXIMUM_STATION_IDENTIFIERS_PER_REQUEST + 1 },
          (_, index) => `fr-${String(index)}`
        ).join(','),
      },
    ],
    ['a malformed identifier', { identifiers: `${RAPEE_IDENTIFIER},FR-12345` }],
  ])('rejects %s with 400', async (_description, query) => {
    const api = await startApplication();

    const response = await api.get(LOOKUP_PATH).query(query).expect(400);

    const apiError = strictApiErrorSchema.parse(response.body);
    expect(apiError.statusCode).toBe(400);
    expect(apiError.message).toContain('identifiers');
    expect(france.requests).toHaveLength(0);
  });
});

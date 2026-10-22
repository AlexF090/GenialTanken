import { stationsSchema } from '@genialtanken/contracts';
import { ERROR_MESSAGES } from '../src/common/error-messages.js';
import { toStationIdentifier } from '../src/fuel-price-providers/station-identifier.js';
import {
  FRENCH_EXPORT_PATH,
  FRENCH_RECORDS_PATH,
} from '../src/fuel-price-providers/france/french-upstream-paths.js';
import { strictApiErrorSchema } from './support/api-errors.js';
import { useTestApplication } from './support/create-test-application.js';
import { searchParametersOf, useFakeUpstream } from './support/fake-upstream.js';
import {
  EXPECTED_RAPEE_STATION,
  frenchRecords,
  frenchResponse,
  OUTSIDE_RADIUS_RECORD_ID,
} from './support/french-records.js';
import { PARIS } from './support/positions.js';

const UNAVAILABLE_BODY = { statusCode: 502, message: ERROR_MESSAGES.upstreamUnavailable };

const ALL_DAY = [{ opening: '00:00', closing: '24:00' }];

const identifiersOf = (body: unknown): string[] =>
  stationsSchema.parse(body).map(station => station.id);

const france = useFakeUpstream();
const startApplication = useTestApplication(() => ({
  FRANCE_FUEL_PRICES_BASE_URL: france.baseUrl,
}));

describe('GET /api/stations', () => {
  beforeEach(() => {
    france.respondTo(FRENCH_EXPORT_PATH, { status: 200, body: frenchRecords });
  });

  it('maps the French records selling the requested fuel, nearest first', async () => {
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

  it('answers every search from the snapshot of the whole dataset', async () => {
    const api = await startApplication();

    await api
      .get('/api/stations')
      .query({ ...PARIS, fuel: 'e10' })
      .expect(200);
    const response = await api
      .get('/api/stations')
      .query({ latitude: '48.86', longitude: '2.38', radiusInKilometers: '3', fuel: 'diesel' })
      .expect(200);

    expect(identifiersOf(response.body)).toEqual(['fr-75011002', 'fr-75012010']);
    expect(france.requests.map(({ url }) => url)).toEqual([
      `${FRENCH_EXPORT_PATH}?select=id%2Cadresse%2Cville%2Ccp%2Cgeom%2Choraires%2Cgazole_prix%2Csp95_prix%2Ce10_prix%2Csp98_prix%2Ce85_prix%2Cgplc_prix`,
    ]);
  });

  it('gives the export its own timeout, longer than the one of other upstream requests', async () => {
    france.respondTo(FRENCH_EXPORT_PATH, {
      status: 200,
      body: frenchRecords,
      delayInMilliseconds: 300,
    });
    const api = await startApplication({
      UPSTREAM_TIMEOUT_IN_MILLISECONDS: '100',
      FRANCE_PRICE_SNAPSHOT_TIMEOUT_IN_SECONDS: '2',
    });

    const response = await api
      .get('/api/stations')
      .query({ ...PARIS, fuel: 'e10' })
      .expect(200);

    expect(identifiersOf(response.body)).toEqual(['fr-75012010', 'fr-75015001']);
    expect(france.requestsTo(FRENCH_RECORDS_PATH)).toHaveLength(0);
  });

  it('includes stations up to the exact requested radius', async () => {
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
      [toStationIdentifier('FR', String(OUTSIDE_RADIUS_RECORD_ID)), 5004],
    ]);
  });

  it('defaults to a 5 km radius and E5', async () => {
    const api = await startApplication();

    const response = await api.get('/api/stations').query(PARIS).expect(200);

    expect(identifiersOf(response.body)).toEqual(['fr-75015001']);
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
    expect(france.requestsTo(FRENCH_RECORDS_PATH)).toHaveLength(0);
  });

  it('skips single malformed records', async () => {
    france.respondTo(FRENCH_EXPORT_PATH, {
      status: 200,
      body: [{ id: 'broken' }, ...frenchRecords],
    });
    const api = await startApplication();

    const response = await api
      .get('/api/stations')
      .query({ ...PARIS, fuel: 'e10' })
      .expect(200);

    expect(identifiersOf(response.body)).toEqual(['fr-75012010', 'fr-75015001']);
  });

  it('caps the response at the 100 nearest stations', async () => {
    // Stations line up due north in steps of 0.001°
    const manyFrenchRecords = Array.from({ length: 120 }, (_, index) => ({
      ...frenchRecords[0],
      id: 1000 + index,
      geom: { lon: 2.3522, lat: 48.8566 + (index + 1) * 0.001 },
    }));
    france.respondTo(FRENCH_EXPORT_PATH, { status: 200, body: manyFrenchRecords });
    const api = await startApplication();

    const response = await api
      .get('/api/stations')
      .query({ ...PARIS, radiusInKilometers: '25', fuel: 'diesel' })
      .expect(200);

    const identifiers = identifiersOf(response.body);
    expect(identifiers).toHaveLength(100);
    expect(identifiers[0]).toBe('fr-1000');
    expect(identifiers.at(-1)).toBe('fr-1099');
  });
});

describe('GET /api/stations without a snapshot of the French dataset', () => {
  beforeEach(() => {
    france.respondTo(FRENCH_EXPORT_PATH, { status: 503 });
  });

  it.each([
    ['fails', { status: 503 }],
    ['returns an unexpected payload', { status: 200, body: frenchResponse(frenchRecords) }],
  ])(
    'asks the French API for stations around the position when the export %s',
    async (_description, exportResponse) => {
      france.respondTo(FRENCH_EXPORT_PATH, exportResponse);
      france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse([]) });
      const api = await startApplication();

      await api
        .get('/api/stations')
        .query({ ...PARIS, radiusInKilometers: '7.5', fuel: 'superPlus' })
        .expect(200);

      const recordsRequests = france.requestsTo(FRENCH_RECORDS_PATH);
      expect(recordsRequests).toHaveLength(1);
      const parameters = searchParametersOf(recordsRequests[0]);
      expect(parameters.get('where')).toBe(
        "within_distance(geom, geom'POINT(2.352 48.857)', 7.5km) and sp98_prix is not null"
      );
      expect(parameters.get('order_by')).toBe("distance(geom, geom'POINT(2.352 48.857)')");
      expect(parameters.get('limit')).toBe('100');
    }
  );

  it('maps the French records of the fallback query', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse(frenchRecords) });
    const api = await startApplication();

    const response = await api
      .get('/api/stations')
      .query({ ...PARIS, fuel: 'e10' })
      .expect(200);

    expect(stationsSchema.parse(response.body)[0]).toEqual(EXPECTED_RAPEE_STATION);
    expect(identifiersOf(response.body)).toEqual(['fr-75012010', 'fr-75015001']);
  });

  it('defaults to a 5 km radius and E5', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse([]) });
    const api = await startApplication();

    await api.get('/api/stations').query(PARIS).expect(200);

    expect(searchParametersOf(france.requestsTo(FRENCH_RECORDS_PATH)[0]).get('where')).toBe(
      "within_distance(geom, geom'POINT(2.352 48.857)', 5km) and sp95_prix is not null"
    );
  });

  it('responds with 502 when the French API returns an unexpected payload', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: { error: 'quota exceeded' } });
    const api = await startApplication();

    const response = await api.get('/api/stations').query(PARIS).expect(502);

    expect(response.body).toEqual(UNAVAILABLE_BODY);
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

    expect(france.requestsTo(FRENCH_RECORDS_PATH)).toHaveLength(1);
    expect(identifiersOf(response.body)).toEqual(['fr-75012010', 'fr-75015001']);
  });

  it('does not cache failures', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 503 });
    const api = await startApplication();

    await api.get('/api/stations').query(PARIS).expect(502);
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse(frenchRecords) });
    await api.get('/api/stations').query(PARIS).expect(200);

    expect(france.requestsTo(FRENCH_RECORDS_PATH)).toHaveLength(2);
  });
});

import {
  MAXIMUM_STATION_IDENTIFIERS_PER_REQUEST,
  stationLookupSchema,
} from '@genialtanken/contracts';
import { ERROR_MESSAGES } from '../src/common/error-messages.js';
import { toStationIdentifier } from '../src/fuel-price-providers/station-identifier.js';
import { FRENCH_RECORDS_PATH } from '../src/fuel-price-providers/france/french-upstream-paths.js';
import { strictApiErrorSchema } from './support/api-errors.js';
import { useTestApplication } from './support/create-test-application.js';
import { searchParametersOf, useFakeUpstream } from './support/fake-upstream.js';
import {
  AUTOMATE_RECORD_ID,
  EXPECTED_RAPEE_STATION,
  frenchResponse,
  RAPEE_RECORD_ID,
  rapeeRecord,
} from './support/french-records.js';
import { PARIS } from './support/positions.js';

const UNAVAILABLE_BODY = { statusCode: 502, message: ERROR_MESSAGES.upstreamUnavailable };
const NOT_FOUND_BODY = { statusCode: 404, message: ERROR_MESSAGES.stationNotFound };

const RAPEE_IDENTIFIER = toStationIdentifier('FR', String(RAPEE_RECORD_ID));

const france = useFakeUpstream();
const startApplication = useTestApplication(() => ({
  FRANCE_FUEL_PRICES_BASE_URL: france.baseUrl,
}));

describe('GET /api/stations/:id', () => {
  it('returns a French station without distance', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, {
      status: 200,
      body: frenchResponse([rapeeRecord]),
    });
    const api = await startApplication();

    const response = await api.get(`/api/stations/${RAPEE_IDENTIFIER}`).expect(200);

    expect(response.body).toEqual({ ...EXPECTED_RAPEE_STATION, distanceInMeters: null });
    expect(searchParametersOf(france.requests[0]).get('where')).toBe('id=75012010');
  });

  it('answers a station of a recent search without asking the French API again', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, {
      status: 200,
      body: frenchResponse([rapeeRecord]),
    });
    const api = await startApplication();
    await api
      .get('/api/stations')
      .query({ ...PARIS, radiusInKilometers: '5', fuel: 'e10' })
      .expect(200);
    france.respondTo(FRENCH_RECORDS_PATH, { status: 500 });

    const response = await api.get(`/api/stations/${RAPEE_IDENTIFIER}`).expect(200);

    expect(response.body).toEqual({ ...EXPECTED_RAPEE_STATION, distanceInMeters: null });
    expect(france.requests).toHaveLength(1);
  });

  it('responds with 404 when the French API does not know the station', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse([]) });
    const api = await startApplication();

    const response = await api
      .get(`/api/stations/${toStationIdentifier('FR', String(AUTOMATE_RECORD_ID))}`)
      .expect(404);

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

    const response = await api.get(`/api/stations/${RAPEE_IDENTIFIER}`).expect(502);

    expect(response.body).toEqual(UNAVAILABLE_BODY);
  });

  it('responds with 502 when the French API answers too late for a station outside any search', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, {
      status: 200,
      body: frenchResponse([rapeeRecord]),
      delayInMilliseconds: 5000,
    });
    const api = await startApplication({ UPSTREAM_TIMEOUT_IN_MILLISECONDS: '100' });

    const response = await api.get(`/api/stations/${RAPEE_IDENTIFIER}`).expect(502);

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
  const UNKNOWN_COUNTRY_IDENTIFIER = 'it-12345';

  it('returns the found stations and lists the others as unavailable, in the requested order', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, {
      status: 200,
      body: frenchResponse([rapeeRecord]),
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

  it('looks up a repeated identifier once and lists its station once', async () => {
    france.respondTo(FRENCH_RECORDS_PATH, {
      status: 200,
      body: frenchResponse([rapeeRecord]),
    });
    const api = await startApplication();

    const response = await api
      .get(LOOKUP_PATH)
      .query({ identifiers: `${RAPEE_IDENTIFIER},${RAPEE_IDENTIFIER}` })
      .expect(200);

    expect(stationLookupSchema.parse(response.body)).toEqual({
      stations: [{ ...EXPECTED_RAPEE_STATION, distanceInMeters: null }],
      unavailableIdentifiers: [],
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
          (_, index) => toStationIdentifier('FR', String(index))
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

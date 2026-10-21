import { apiErrorSchema, placesSchema } from '@genialtanken/contracts';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApplication } from './support/create-test-application.js';
import type { EnvironmentOverrides } from './support/create-test-application.js';
import { FakeUpstream } from './support/fake-upstream.js';
import type { RecordedRequest } from './support/fake-upstream.js';
import { bastilleFeatures, PHOTON_SEARCH_PATH, photonResponse } from './support/photon-features.js';

const strictApiErrorSchema = apiErrorSchema.strict();

const MILLISECONDS_PER_SECOND = 1000;

const UNAVAILABLE_BODY = { statusCode: 502, message: 'The place search is unavailable.' };

const searchParametersOf = (recordedRequest: RecordedRequest | undefined): URLSearchParams =>
  new URL(recordedRequest?.url ?? '/', 'http://fake-upstream').searchParams;

let photon: FakeUpstream;
let application: NestExpressApplication | undefined;

const startApplication = async (overrides: EnvironmentOverrides = {}) => {
  application = await createTestApplication({ PHOTON_BASE_URL: photon.baseUrl, ...overrides });
  return request(application.getHttpServer());
};

beforeEach(async () => {
  photon = await FakeUpstream.start();
});

afterEach(async () => {
  await application?.close();
  application = undefined;
  await photon.stop();
});

describe('GET /api/places', () => {
  it('maps places in France once each, in upstream order', async () => {
    photon.respondTo(PHOTON_SEARCH_PATH, { status: 200, body: photonResponse(bastilleFeatures) });
    const api = await startApplication();

    const response = await api.get('/api/places').query({ query: 'bastille' }).expect(200);

    expect(placesSchema.parse(response.body)).toEqual([
      {
        id: 'N1584432760',
        name: 'Bastille',
        description: '75011 Paris, Frankreich',
        country: 'FR',
        latitude: 48.8536788,
        longitude: 2.3691871,
      },
      {
        id: 'N206670863',
        name: 'Rue de la Bastille 4',
        description: '44000 Nantes, Frankreich',
        country: 'FR',
        latitude: 47.2196414,
        longitude: -1.5626711,
      },
    ]);
  });

  it('asks Photon for twice the limit in German, restricted to France', async () => {
    photon.respondTo(PHOTON_SEARCH_PATH, { status: 200, body: photonResponse([]) });
    const api = await startApplication();

    await api.get('/api/places').query({ query: '  Place  de la BASTILLE ', limit: 3 }).expect(200);

    const parameters = searchParametersOf(photon.requests[0]);
    expect(Object.fromEntries(parameters)).toEqual({
      q: 'place de la bastille',
      lang: 'de',
      limit: '6',
      bbox: '-5.3,41.3,9.7,51.2',
    });
  });

  it('cuts the places to the limit', async () => {
    photon.respondTo(PHOTON_SEARCH_PATH, { status: 200, body: photonResponse(bastilleFeatures) });
    const api = await startApplication();

    const response = await api
      .get('/api/places')
      .query({ query: 'bastille', limit: 1 })
      .expect(200);

    expect(placesSchema.parse(response.body).map(place => place.id)).toEqual(['N1584432760']);
  });

  it('identifies itself to Photon with an application User-Agent', async () => {
    photon.respondTo(PHOTON_SEARCH_PATH, { status: 200, body: photonResponse([]) });
    const api = await startApplication();

    await api.get('/api/places').query({ query: 'lyon' }).expect(200);

    expect(photon.requests[0]?.headers['user-agent']).toMatch(
      /^GenialTanken\/\d+\.\d+\.\d+ \(\+https:\/\/genialtanken\.alexf090\.workers\.dev\)$/
    );
  });

  it('serves the same normalized query from the cache', async () => {
    photon.respondTo(PHOTON_SEARCH_PATH, { status: 200, body: photonResponse(bastilleFeatures) });
    const api = await startApplication();

    const first = await api.get('/api/places').query({ query: 'bastille' }).expect(200);
    const second = await api.get('/api/places').query({ query: ' BASTILLE' }).expect(200);

    expect(second.body).toEqual(first.body);
    expect(photon.requests).toHaveLength(1);
  });

  it('asks Photon again for a different limit', async () => {
    photon.respondTo(PHOTON_SEARCH_PATH, { status: 200, body: photonResponse(bastilleFeatures) });
    const api = await startApplication();

    await api.get('/api/places').query({ query: 'bastille', limit: 2 }).expect(200);
    await api.get('/api/places').query({ query: 'bastille', limit: 3 }).expect(200);

    expect(photon.requests).toHaveLength(2);
  });

  it('caches places longer than fuel prices', async () => {
    photon.respondTo(PHOTON_SEARCH_PATH, { status: 200, body: photonResponse(bastilleFeatures) });
    const api = await startApplication({
      CACHE_TIME_TO_LIVE_IN_SECONDS: '1',
      PLACES_CACHE_TIME_TO_LIVE_IN_SECONDS: '60',
    });

    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      await api.get('/api/places').query({ query: 'bastille' }).expect(200);
      vi.setSystemTime(Date.now() + 2 * MILLISECONDS_PER_SECOND);
      await api.get('/api/places').query({ query: 'bastille' }).expect(200);
      expect(photon.requests).toHaveLength(1);

      vi.setSystemTime(Date.now() + 60 * MILLISECONDS_PER_SECOND);
      await api.get('/api/places').query({ query: 'bastille' }).expect(200);
      expect(photon.requests).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('evicts the least recently used answer once the cache is full', async () => {
    photon.respondTo(PHOTON_SEARCH_PATH, { status: 200, body: photonResponse(bastilleFeatures) });
    const api = await startApplication({ CACHE_MAXIMUM_ENTRIES: '1' });

    await api.get('/api/places').query({ query: 'bastille' }).expect(200);
    await api.get('/api/places').query({ query: 'lyon' }).expect(200);
    await api.get('/api/places').query({ query: 'bastille' }).expect(200);

    expect(photon.requests.map(recorded => searchParametersOf(recorded).get('q'))).toEqual([
      'bastille',
      'lyon',
      'bastille',
    ]);
  });

  it.each([
    ['a missing query', {}],
    ['a query shorter than three characters', { query: ' ab ' }],
    ['a limit above the maximum', { query: 'bastille', limit: 11 }],
    ['a limit that is not a number', { query: 'bastille', limit: 'many' }],
  ])('rejects %s with 400 without asking Photon', async (_description, query) => {
    const api = await startApplication();

    const response = await api.get('/api/places').query(query).expect(400);

    expect(strictApiErrorSchema.parse(response.body).statusCode).toBe(400);
    expect(photon.requests).toHaveLength(0);
  });

  it.each([
    ['an error status', { status: 500, body: { message: 'Internal Server Error' } }],
    ['a 404', { status: 404, body: { message: 'Not Found' } }],
    ['a body that is not JSON', { status: 200, body: 'not json' }],
    ['an unexpected payload', { status: 200, body: { features: 'none' } }],
  ])('answers 502 when Photon responds with %s', async (_description, fakeResponse) => {
    photon.respondTo(PHOTON_SEARCH_PATH, fakeResponse);
    const api = await startApplication();

    const response = await api.get('/api/places').query({ query: 'bastille' }).expect(502);

    expect(strictApiErrorSchema.parse(response.body)).toEqual(UNAVAILABLE_BODY);
  });

  it('answers 502 when Photon does not answer in time', async () => {
    photon.respondTo(PHOTON_SEARCH_PATH, {
      status: 200,
      body: photonResponse(bastilleFeatures),
      delayInMilliseconds: 500,
    });
    const api = await startApplication({ UPSTREAM_TIMEOUT_IN_MILLISECONDS: '100' });

    const response = await api.get('/api/places').query({ query: 'bastille' }).expect(502);

    expect(strictApiErrorSchema.parse(response.body)).toEqual(UNAVAILABLE_BODY);
  });

  it('does not cache failures', async () => {
    photon.respondTo(PHOTON_SEARCH_PATH, { status: 500, body: { message: 'Down' } });
    const api = await startApplication();
    await api.get('/api/places').query({ query: 'bastille' }).expect(502);

    photon.respondTo(PHOTON_SEARCH_PATH, { status: 200, body: photonResponse(bastilleFeatures) });

    await api.get('/api/places').query({ query: 'bastille' }).expect(200);
    expect(photon.requests).toHaveLength(2);
  });
});

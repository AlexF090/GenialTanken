import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { FRENCH_RECORDS_PATH } from '../src/fuel-price-providers/france/french-upstream-paths.js';
import { strictApiErrorSchema } from './support/api-errors.js';
import { useTestApplication } from './support/create-test-application.js';
import { useFakeUpstream } from './support/fake-upstream.js';
import { frenchResponse } from './support/french-records.js';
import { PARIS } from './support/positions.js';

const ALLOWED_ORIGIN = 'https://genial-tanken.appool.de';
const PREVIOUS_ORIGIN = 'https://genialtanken.alexf090.workers.dev';

const requiredPropertiesSchema = z.object({ required: z.array(z.string()) });

const openApiInformationSchema = z.object({ info: z.object({ version: z.string() }) });

/** semantic-release bumps the version in package.json with every release. */
const packageVersion = z
  .object({ version: z.string() })
  .parse(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))).version;

const openApiOperationSchema = z.object({
  summary: z.string().min(1),
  responses: z.record(z.string(), z.unknown()),
});

const openApiDocumentSchema = z.object({
  paths: z.record(z.string(), z.object({ get: openApiOperationSchema })),
  components: z.object({
    schemas: z.object({
      Station: requiredPropertiesSchema,
      StationLookup: requiredPropertiesSchema,
      Place: requiredPropertiesSchema,
      ApiError: requiredPropertiesSchema,
      HealthCheck: requiredPropertiesSchema,
    }),
  }),
});

const stationParameterSchema = z.object({
  paths: z.object({
    '/api/stations/{id}': z.object({
      get: z.object({
        parameters: z.array(
          z.object({ name: z.string(), in: z.string(), schema: z.object({ pattern: z.string() }) })
        ),
      }),
    }),
  }),
});

const upstream = useFakeUpstream();
const startApplication = useTestApplication(() => ({
  FRANCE_FUEL_PRICES_BASE_URL: upstream.baseUrl,
}));

beforeEach(() => {
  upstream.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse([]) });
});

describe('GET /health', () => {
  it('reports the application as up without calling the upstream', async () => {
    const api = await startApplication();

    const response = await api.get('/health').expect(200);

    expect(response.body).toEqual(expect.objectContaining({ status: 'ok' }));
    expect(upstream.requests).toHaveLength(0);
  });

  it('is not served below the api prefix', async () => {
    const api = await startApplication();

    const response = await api.get('/api/health').expect(404);

    expect(response.body).toEqual({ statusCode: 404, message: 'Cannot GET /api/health' });
  });
});

describe('GET /api/wake-up', () => {
  it('answers without content and without calling the upstream', async () => {
    const api = await startApplication();

    const response = await api.get('/api/wake-up').expect(204);

    expect(response.text).toBe('');
    expect(upstream.requests).toHaveLength(0);
  });

  it('is rate limited like every other api route', async () => {
    const api = await startApplication({ RATE_LIMIT_REQUESTS_PER_MINUTE: '1' });

    await api.get('/api/wake-up').expect(204);
    const response = await api.get('/api/wake-up').expect(429);

    expect(strictApiErrorSchema.parse(response.body).statusCode).toBe(429);
  });

  it('counts its rate limit apart from the station search, like every route', async () => {
    const api = await startApplication({ RATE_LIMIT_REQUESTS_PER_MINUTE: '1' });

    await api.get('/api/wake-up').expect(204);
    await api.get('/api/stations').query(PARIS).expect(200);
    await api.get('/api/wake-up').expect(429);
  });
});

describe('OpenAPI document', () => {
  it('documents the stations and places endpoints with the contract schemas', async () => {
    const api = await startApplication();

    const response = await api.get('/api/docs-json').expect(200);

    const { paths, components } = openApiDocumentSchema.parse(response.body);
    expect(Object.keys(paths)).toEqual([
      '/health',
      '/api/wake-up',
      '/api/stations',
      '/api/stations/by-identifiers',
      '/api/stations/{id}',
      '/api/places',
    ]);
    expect(components.schemas.Station.required).toEqual(
      expect.arrayContaining(['id', 'pricesInEuro', 'distanceInMeters'])
    );
    expect(components.schemas.StationLookup.required).toEqual([
      'stations',
      'unavailableIdentifiers',
      'failedIdentifiers',
    ]);
    expect(components.schemas.Place.required).toEqual(
      expect.arrayContaining(['id', 'name', 'description', 'country', 'latitude', 'longitude'])
    );
    expect(components.schemas.ApiError.required).toEqual(['statusCode', 'message']);
    expect(components.schemas.HealthCheck.required).toEqual(
      expect.arrayContaining(['status', 'details'])
    );
  });

  it('documents the pattern of the station identifier', async () => {
    const api = await startApplication();

    const response = await api.get('/api/docs-json').expect(200);

    const { parameters } = stationParameterSchema.parse(response.body).paths['/api/stations/{id}']
      .get;
    expect(parameters).toEqual([
      { name: 'id', in: 'path', schema: { pattern: '^[a-z]{2}-[A-Za-z0-9-]+$' } },
    ]);
  });

  it('reports the released application version', async () => {
    const api = await startApplication();

    const response = await api.get('/api/docs-json').expect(200);

    expect(openApiInformationSchema.parse(response.body).info.version).toBe(packageVersion);
  });
});

describe('CORS', () => {
  it('allows the configured web origins', async () => {
    const api = await startApplication({
      WEB_ORIGIN: `${ALLOWED_ORIGIN}, ${PREVIOUS_ORIGIN} ,http://localhost:4200`,
    });

    const response = await api
      .get('/api/stations')
      .query(PARIS)
      .set('Origin', ALLOWED_ORIGIN)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });

  it('allows every origin of a list during a move, and only those', async () => {
    const api = await startApplication({ WEB_ORIGIN: `${ALLOWED_ORIGIN},${PREVIOUS_ORIGIN}` });

    const previous = await api.get('/api/stations').query(PARIS).set('Origin', PREVIOUS_ORIGIN);
    const current = await api.get('/api/stations').query(PARIS).set('Origin', ALLOWED_ORIGIN);
    const other = await api.get('/api/stations').query(PARIS).set('Origin', 'https://appool.de');

    expect(previous.headers['access-control-allow-origin']).toBe(PREVIOUS_ORIGIN);
    expect(current.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers the preflight of the web app and lets the browser cache it', async () => {
    const api = await startApplication({ WEB_ORIGIN: ALLOWED_ORIGIN });

    const response = await api
      .options('/api/stations')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'ngsw-bypass')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(response.headers['access-control-allow-headers']).toBe('ngsw-bypass');
    expect(response.headers['access-control-max-age']).toBe('86400');
  });

  it('defaults to the local Angular dev server', async () => {
    const api = await startApplication();

    const response = await api
      .get('/api/stations')
      .query(PARIS)
      .set('Origin', 'http://localhost:4200')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:4200');
  });

  it('does not allow other origins', async () => {
    const api = await startApplication({ WEB_ORIGIN: ALLOWED_ORIGIN });

    const response = await api
      .get('/api/stations')
      .query(PARIS)
      .set('Origin', 'https://attacker.example')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Rate limit', () => {
  it('responds with 429 once a client exceeds the limit, except for the health check', async () => {
    const api = await startApplication({ RATE_LIMIT_REQUESTS_PER_MINUTE: '2' });

    await api.get('/api/stations').query(PARIS).expect(200);
    await api.get('/api/stations').query(PARIS).expect(200);
    const response = await api.get('/api/stations').query(PARIS).expect(429);

    expect(strictApiErrorSchema.parse(response.body).statusCode).toBe(429);
    await api.get('/health').expect(200);
  });

  it('trusts only the Render proxy for X-Forwarded-For', async () => {
    const api = await startApplication({ RATE_LIMIT_REQUESTS_PER_MINUTE: '1' });

    await api
      .get('/api/stations')
      .query(PARIS)
      .set('X-Forwarded-For', '198.51.100.7, 172.68.10.1')
      .expect(200);
    await api
      .get('/api/stations')
      .query(PARIS)
      .set('X-Forwarded-For', '203.0.113.9, 172.68.10.1')
      .expect(429);
  });

  it('ignores client address headers of the former Worker proxy', async () => {
    const api = await startApplication({ RATE_LIMIT_REQUESTS_PER_MINUTE: '1' });

    await api
      .get('/api/stations')
      .query(PARIS)
      .set('X-GenialTanken-Client-Address', '198.51.100.7')
      .expect(200);
    await api
      .get('/api/stations')
      .query(PARIS)
      .set('X-GenialTanken-Client-Address', '203.0.113.9')
      .expect(429);
  });
});

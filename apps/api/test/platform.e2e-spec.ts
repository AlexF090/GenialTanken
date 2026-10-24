import { readFileSync } from 'node:fs';
import { CLIENT_ADDRESS_HEADER, PROXY_SECRET_HEADER } from '@genialtanken/contracts';
import { z } from 'zod';
import { FRENCH_RECORDS_PATH } from '../src/fuel-price-providers/france/french-upstream-paths.js';
import { strictApiErrorSchema } from './support/api-errors.js';
import { useTestApplication } from './support/create-test-application.js';
import type { TestApi } from './support/create-test-application.js';
import type { EnvironmentVariables } from '../src/configuration/environment.js';
import { useFakeUpstream } from './support/fake-upstream.js';
import { frenchResponse } from './support/french-records.js';
import { PARIS } from './support/positions.js';

const ALLOWED_ORIGIN = 'https://genialtanken.alexf090.workers.dev';

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

describe('OpenAPI document', () => {
  it('documents the stations and places endpoints with the contract schemas', async () => {
    const api = await startApplication();

    const response = await api.get('/api/docs-json').expect(200);

    const { paths, components } = openApiDocumentSchema.parse(response.body);
    expect(Object.keys(paths)).toEqual([
      '/health',
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
      WEB_ORIGIN: `${ALLOWED_ORIGIN},http://localhost:4200`,
    });

    const response = await api
      .get('/api/stations')
      .query(PARIS)
      .set('Origin', ALLOWED_ORIGIN)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
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
});

describe('Rate limit behind the Cloudflare Worker', () => {
  const PROXY_SHARED_SECRET = 'a-proxy-shared-secret-of-at-least-32-characters';

  const startBehindWorker = (variables: EnvironmentVariables = {}) =>
    startApplication({ RATE_LIMIT_REQUESTS_PER_MINUTE: '1', PROXY_SHARED_SECRET, ...variables });

  const requestFrom = (api: TestApi, clientAddress: string, secret?: string) => {
    const pending = api.get('/api/stations').query(PARIS).set(CLIENT_ADDRESS_HEADER, clientAddress);
    return secret === undefined ? pending : pending.set(PROXY_SECRET_HEADER, secret);
  };

  it('limits each client separately when the Worker sends the shared secret', async () => {
    const api = await startBehindWorker();

    await requestFrom(api, '198.51.100.7', PROXY_SHARED_SECRET).expect(200);
    await requestFrom(api, '2001:db8::1', PROXY_SHARED_SECRET).expect(200);
    await requestFrom(api, '198.51.100.7', PROXY_SHARED_SECRET).expect(429);
  });

  it('ignores the client address without the shared secret', async () => {
    const api = await startBehindWorker();

    await requestFrom(api, '198.51.100.7').expect(200);
    await requestFrom(api, '203.0.113.9').expect(429);
  });

  it.each([
    ['a wrong secret', 'a-wrong-secret-of-at-least-thirty-two-characters'],
    ['a prefix of the secret', PROXY_SHARED_SECRET.slice(0, 10)],
  ])('ignores the client address with %s', async (_description, secret) => {
    const api = await startBehindWorker();

    await requestFrom(api, '198.51.100.7', secret).expect(200);
    await requestFrom(api, '203.0.113.9', secret).expect(429);
  });

  it('ignores the client address when no shared secret is configured', async () => {
    const api = await startBehindWorker({ PROXY_SHARED_SECRET: undefined });

    await requestFrom(api, '198.51.100.7', PROXY_SHARED_SECRET).expect(200);
    await requestFrom(api, '203.0.113.9', PROXY_SHARED_SECRET).expect(429);
  });

  it('falls back to the connecting address when the client address is not an IP', async () => {
    const api = await startBehindWorker();

    await requestFrom(api, 'not-an-address', PROXY_SHARED_SECRET).expect(200);
    await requestFrom(api, 'another-made-up-address', PROXY_SHARED_SECRET).expect(429);
  });
});

import { apiErrorSchema } from '@genialtanken/contracts';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { z } from 'zod';
import { createTestApplication } from './support/create-test-application.js';
import type { EnvironmentOverrides } from './support/create-test-application.js';
import { FakeUpstream } from './support/fake-upstream.js';
import { FRENCH_RECORDS_PATH, frenchResponse } from './support/french-records.js';

const ALLOWED_ORIGIN = 'https://genialtanken.pages.dev';

const requiredPropertiesSchema = z.object({ required: z.array(z.string()) });

const openApiInformationSchema = z.object({ info: z.object({ version: z.string() }) });

const openApiDocumentSchema = z.object({
  paths: z.record(z.string(), z.unknown()),
  components: z.object({
    schemas: z.object({ Station: requiredPropertiesSchema, ApiError: requiredPropertiesSchema }),
  }),
});

let upstream: FakeUpstream;
let application: NestExpressApplication | undefined;

const startApplication = async (overrides: EnvironmentOverrides = {}) => {
  application = await createTestApplication({
    FRANCE_FUEL_PRICES_BASE_URL: upstream.baseUrl,
    ...overrides,
  });
  return request(application.getHttpServer());
};

beforeEach(async () => {
  upstream = await FakeUpstream.start();
  upstream.respondTo(FRENCH_RECORDS_PATH, { status: 200, body: frenchResponse([]) });
});

afterEach(async () => {
  await application?.close();
  application = undefined;
  await upstream.stop();
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
  it('documents the stations endpoints with the contract schemas', async () => {
    const api = await startApplication();

    const response = await api.get('/api/docs-json').expect(200);

    const { paths, components } = openApiDocumentSchema.parse(response.body);
    expect(Object.keys(paths)).toEqual(['/health', '/api/stations', '/api/stations/{id}']);
    expect(components.schemas.Station.required).toEqual(
      expect.arrayContaining(['id', 'pricesInEuro', 'distanceInMeters'])
    );
    expect(components.schemas.ApiError.required).toEqual(['statusCode', 'message']);
  });

  it('reports the released application version', async () => {
    const api = await startApplication();

    const response = await api.get('/api/docs-json').expect(200);

    expect(openApiInformationSchema.parse(response.body).info.version).toBe('2.0.0');
  });
});

describe('CORS', () => {
  it('allows the configured web origins', async () => {
    const api = await startApplication({
      WEB_ORIGIN: `${ALLOWED_ORIGIN},http://localhost:4200`,
    });

    const response = await api
      .get('/api/stations')
      .query({ latitude: '51.3', longitude: '9.4' })
      .set('Origin', ALLOWED_ORIGIN)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });

  it('defaults to the local Angular dev server', async () => {
    const api = await startApplication();

    const response = await api
      .get('/api/stations')
      .query({ latitude: '51.3', longitude: '9.4' })
      .set('Origin', 'http://localhost:4200')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:4200');
  });

  it('does not allow other origins', async () => {
    const api = await startApplication({ WEB_ORIGIN: ALLOWED_ORIGIN });

    const response = await api
      .get('/api/stations')
      .query({ latitude: '51.3', longitude: '9.4' })
      .set('Origin', 'https://attacker.example')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Rate limit', () => {
  it('responds with 429 once a client exceeds the limit, except for the health check', async () => {
    const api = await startApplication({ RATE_LIMIT_REQUESTS_PER_MINUTE: '2' });
    const query = { latitude: '51.3', longitude: '9.4' };

    await api.get('/api/stations').query(query).expect(200);
    await api.get('/api/stations').query(query).expect(200);
    const response = await api.get('/api/stations').query(query).expect(429);

    expect(apiErrorSchema.strict().parse(response.body).statusCode).toBe(429);
    await api.get('/health').expect(200);
  });

  it('trusts only the Render proxy for X-Forwarded-For', async () => {
    const api = await startApplication({ RATE_LIMIT_REQUESTS_PER_MINUTE: '1' });
    const query = { latitude: '51.3', longitude: '9.4' };

    await api
      .get('/api/stations')
      .query(query)
      .set('X-Forwarded-For', '198.51.100.7, 172.68.10.1')
      .expect(200);
    await api
      .get('/api/stations')
      .query(query)
      .set('X-Forwarded-For', '203.0.113.9, 172.68.10.1')
      .expect(429);
  });
});

describe('Rate limit behind the Cloudflare Pages Function', () => {
  const PROXY_SHARED_SECRET = 'a-proxy-shared-secret-of-at-least-32-characters';
  const query = { latitude: '51.3', longitude: '9.4' };

  const startBehindPagesFunction = (overrides: EnvironmentOverrides = {}) =>
    startApplication({ RATE_LIMIT_REQUESTS_PER_MINUTE: '1', PROXY_SHARED_SECRET, ...overrides });

  const requestFrom = (
    api: Awaited<ReturnType<typeof startApplication>>,
    clientAddress: string,
    secret?: string
  ) => {
    const pending = api
      .get('/api/stations')
      .query(query)
      .set('X-GenialTanken-Client-Address', clientAddress);
    return secret === undefined ? pending : pending.set('X-GenialTanken-Proxy-Secret', secret);
  };

  it('limits each client separately when the Pages Function sends the shared secret', async () => {
    const api = await startBehindPagesFunction();

    await requestFrom(api, '198.51.100.7', PROXY_SHARED_SECRET).expect(200);
    await requestFrom(api, '2001:db8::1', PROXY_SHARED_SECRET).expect(200);
    await requestFrom(api, '198.51.100.7', PROXY_SHARED_SECRET).expect(429);
  });

  it('ignores the client address without the shared secret', async () => {
    const api = await startBehindPagesFunction();

    await requestFrom(api, '198.51.100.7').expect(200);
    await requestFrom(api, '203.0.113.9').expect(429);
  });

  it.each([
    ['a wrong secret', 'a-wrong-secret-of-at-least-thirty-two-characters'],
    ['a prefix of the secret', PROXY_SHARED_SECRET.slice(0, 10)],
  ])('ignores the client address with %s', async (_description, secret) => {
    const api = await startBehindPagesFunction();

    await requestFrom(api, '198.51.100.7', secret).expect(200);
    await requestFrom(api, '203.0.113.9', secret).expect(429);
  });

  it('ignores the client address when no shared secret is configured', async () => {
    const api = await startBehindPagesFunction({ PROXY_SHARED_SECRET: undefined });

    await requestFrom(api, '198.51.100.7', PROXY_SHARED_SECRET).expect(200);
    await requestFrom(api, '203.0.113.9', PROXY_SHARED_SECRET).expect(429);
  });

  it('falls back to the connecting address when the client address is not an IP', async () => {
    const api = await startBehindPagesFunction();

    await requestFrom(api, 'not-an-address', PROXY_SHARED_SECRET).expect(200);
    await requestFrom(api, 'another-made-up-address', PROXY_SHARED_SECRET).expect(429);
  });
});

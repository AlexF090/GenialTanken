import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { proxyApiRequest } from './proxy-api-request.ts';
import type { FetchImplementation } from './proxy-api-request.ts';

const API_ORIGIN = 'https://genialtanken-api.onrender.com';
const STATIONS_REQUEST_URL = 'https://genialtanken.pages.dev/api/stations?latitude=48.85';

const respondWith =
  (response: Response): FetchImplementation =>
  () =>
    Promise.resolve(response);

describe('proxyApiRequest', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the response of the API', async () => {
    const forwardedUrls: string[] = [];
    const fetchImplementation: FetchImplementation = request => {
      forwardedUrls.push(request.url);
      return Promise.resolve(Response.json([], { status: 200 }));
    };

    const response = await proxyApiRequest(
      new Request(STATIONS_REQUEST_URL),
      { API_ORIGIN },
      fetchImplementation
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
    expect(forwardedUrls).toEqual([`${API_ORIGIN}/api/stations?latitude=48.85`]);
  });

  it('passes API errors through unchanged', async () => {
    const response = await proxyApiRequest(
      new Request(STATIONS_REQUEST_URL),
      { API_ORIGIN },
      respondWith(Response.json({ statusCode: 429, message: 'Too Many Requests' }, { status: 429 }))
    );

    expect(response.status).toBe(429);
  });

  it('forwards the proxy secret when one is configured', async () => {
    const forwardedSecrets: (string | null)[] = [];
    const fetchImplementation: FetchImplementation = request => {
      forwardedSecrets.push(request.headers.get('X-GenialTanken-Proxy-Secret'));
      return Promise.resolve(new Response(null, { status: 204 }));
    };

    await proxyApiRequest(
      new Request(STATIONS_REQUEST_URL),
      { API_ORIGIN, API_PROXY_SECRET: 'proxy-secret' },
      fetchImplementation
    );

    expect(forwardedSecrets).toEqual(['proxy-secret']);
  });

  it.each([
    ['missing', {}],
    ['empty', { API_ORIGIN: '' }],
    ['not a URL', { API_ORIGIN: 'genialtanken-api' }],
  ])('answers 500 without calling the API when API_ORIGIN is %s', async (_case, environment) => {
    const fetchImplementation = vi.fn<FetchImplementation>();

    const response = await proxyApiRequest(
      new Request(STATIONS_REQUEST_URL),
      environment,
      fetchImplementation
    );

    expect(fetchImplementation).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({
      statusCode: 500,
      message: 'The API proxy is not configured.',
    });
  });

  it('answers 502 when the API cannot be reached', async () => {
    const response = await proxyApiRequest(new Request(STATIONS_REQUEST_URL), { API_ORIGIN }, () =>
      Promise.reject(new TypeError('Network connection lost.'))
    );

    expect(response.status).toBe(502);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({
      statusCode: 502,
      message: 'The fuel price service is unavailable.',
    });
  });
});

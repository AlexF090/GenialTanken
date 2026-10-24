import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index.ts';
import type { ExecutionContext, StaticAssetsBinding, WorkerEnvironment } from './index.ts';

const API_ORIGIN = 'https://genialtanken-api.onrender.com';
const WORKER_ORIGIN = 'https://genialtanken.alexf090.workers.dev';

const createEnvironment = (assetsFetch: StaticAssetsBinding['fetch']): WorkerEnvironment => ({
  API_ORIGIN,
  PROXY_SHARED_SECRET: 'proxy-secret',
  ASSETS: { fetch: assetsFetch },
});

describe('worker', () => {
  const apiFetch = vi.fn<typeof fetch>();
  const assetsFetch = vi.fn<StaticAssetsBinding['fetch']>();

  beforeEach(() => {
    apiFetch.mockResolvedValue(Response.json([], { status: 200 }));
    assetsFetch.mockResolvedValue(new Response('<!doctype html>', { status: 200 }));
    vi.stubGlobal('fetch', apiFetch);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it.each(['/api/stations?latitude=48.85', '/api'])(
    'proxies %s to the API without touching the assets',
    async pathAndQuery => {
      const response = await worker.fetch(
        new Request(`${WORKER_ORIGIN}${pathAndQuery}`, {
          headers: { 'CF-Connecting-IP': '198.51.100.7' },
        }),
        createEnvironment(assetsFetch)
      );

      expect(response.status).toBe(200);
      expect(assetsFetch).not.toHaveBeenCalled();
      expect(apiFetch).toHaveBeenCalledTimes(1);
      const [apiRequest] = apiFetch.mock.calls[0] ?? [];
      if (!(apiRequest instanceof Request)) {
        throw new Error('Expected the worker to forward a Request.');
      }
      expect(apiRequest.url).toBe(`${API_ORIGIN}${pathAndQuery}`);
      expect(apiRequest.headers.get('X-GenialTanken-Proxy-Secret')).toBe('proxy-secret');
      expect(apiRequest.headers.get('X-GenialTanken-Client-Address')).toBe('198.51.100.7');
    }
  );

  it.each(['/', '/stations/fr-75012010', '/main.js', '/apix', '/settings/api/stations'])(
    'delegates %s to the static assets',
    async path => {
      const request = new Request(`${WORKER_ORIGIN}${path}`);

      const response = await worker.fetch(request, createEnvironment(assetsFetch));

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe('<!doctype html>');
      expect(assetsFetch).toHaveBeenCalledWith(request);
      expect(apiFetch).not.toHaveBeenCalled();
    }
  );

  it('wakes the API through the cron trigger within the awake hours', async () => {
    const scheduledTime = Date.parse('2026-07-15T10:00:00Z');
    vi.useFakeTimers({ now: scheduledTime });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const pending: Promise<unknown>[] = [];
    const context: ExecutionContext = { waitUntil: promise => pending.push(promise) };

    worker.scheduled({ scheduledTime }, createEnvironment(assetsFetch), context);
    await vi.runAllTimersAsync();
    await Promise.all(pending);

    expect(pending).toHaveLength(1);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    const [healthCheck] = apiFetch.mock.calls[0] ?? [];
    if (!(healthCheck instanceof Request)) {
      throw new Error('Expected the worker to send a Request.');
    }
    expect(healthCheck.url).toBe(`${API_ORIGIN}/health`);
  });
});

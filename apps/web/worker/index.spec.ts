import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index.ts';
import type { ExecutionContext, WorkerEnvironment } from './index.ts';

const API_ORIGIN = 'https://genialtanken-api.onrender.com';
const WORKER_ORIGIN = 'https://genialtanken.alexf090.workers.dev';
const WEB_ORIGIN = 'https://genial-tanken.appool.de';

const environment: WorkerEnvironment = { API_ORIGIN };

describe('worker', () => {
  const apiFetch = vi.fn<typeof fetch>();

  beforeEach(() => {
    apiFetch.mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', apiFetch);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it.each([
    ['/', `${WEB_ORIGIN}/`],
    ['/stations/fr-75012010', `${WEB_ORIGIN}/stations/fr-75012010`],
    ['/favorites', `${WEB_ORIGIN}/favorites`],
    ['/main.js', `${WEB_ORIGIN}/main.js`],
    ['/search?q=a%20b#ignored', `${WEB_ORIGIN}/search?q=a%20b`],
  ])('redirects %s permanently to %s', async (pathAndQuery, expectedLocation) => {
    const response = await worker.fetch(new Request(`${WORKER_ORIGIN}${pathAndQuery}`));

    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(expectedLocation);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it.each(['POST', 'PUT', 'DELETE'])('redirects %s requests as well', async method => {
    const response = await worker.fetch(
      new Request(`${WORKER_ORIGIN}/stations`, { method, body: 'payload' })
    );

    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(`${WEB_ORIGIN}/stations`);
  });

  it.each([
    '/api',
    '/api/',
    '/api/stations?latitude=48.85&longitude=2.35&fuel=e10',
    '/api/wake-up',
  ])('answers the former API path %s with 410 Gone, not with HTML of the web app', async path => {
    const response = await worker.fetch(new Request(`${WORKER_ORIGIN}${path}`));

    expect(response.status).toBe(410);
    expect(response.headers.get('Location')).toBeNull();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('does not mistake paths that only start with the letters api for the API', async () => {
    const response = await worker.fetch(new Request(`${WORKER_ORIGIN}/apix`));

    expect(response.status).toBe(301);
  });

  it('keeps the redirect out of caches that would outlive the move', async () => {
    const response = await worker.fetch(new Request(`${WORKER_ORIGIN}/`));

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
  });

  it('answers the manifest of the old service worker with 404, so it unregisters itself', async () => {
    const response = await worker.fetch(
      new Request(`${WORKER_ORIGIN}/ngsw.json?ngsw-cache-bust=0.5`)
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('Location')).toBeNull();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('wakes the API through the cron trigger within the awake hours', async () => {
    const scheduledTime = Date.parse('2026-07-15T10:00:00Z');
    vi.useFakeTimers({ now: scheduledTime });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const pending: Promise<unknown>[] = [];
    const context: ExecutionContext = { waitUntil: promise => pending.push(promise) };

    worker.scheduled({ scheduledTime }, environment, context);
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

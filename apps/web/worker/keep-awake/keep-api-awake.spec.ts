import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FetchImplementation } from '../api/proxy-api-request.ts';
import {
  HEALTH_CHECK_TIMEOUT_IN_MILLISECONDS,
  MAXIMUM_DELAY_IN_MILLISECONDS,
  isWithinAwakeHours,
  keepApiAwake,
} from './keep-api-awake.ts';
import type { KeepAwakeDependencies } from './keep-api-awake.ts';

const API_ORIGIN = 'https://genialtanken-api.onrender.com';
/** 12:00 in Berlin (winter time, UTC+1). */
const WINTER_NOON = new Date('2026-01-15T11:00:00Z');

describe('isWithinAwakeHours', () => {
  it.each([
    ['05:59 Berlin winter time', '2026-01-15T04:59:00Z', false],
    ['06:00 Berlin winter time', '2026-01-15T05:00:00Z', true],
    ['23:59 Berlin winter time', '2026-01-15T22:59:00Z', true],
    ['00:00 Berlin winter time', '2026-01-15T23:00:00Z', false],
    ['05:59 Berlin summer time', '2026-07-15T03:59:00Z', false],
    ['06:00 Berlin summer time', '2026-07-15T04:00:00Z', true],
    ['23:59 Berlin summer time', '2026-07-15T21:59:00Z', true],
    ['00:00 Berlin summer time', '2026-07-15T22:00:00Z', false],
    ['06:00 on the day summer time starts', '2026-03-29T04:00:00Z', true],
    ['05:00 on the day summer time starts', '2026-03-29T03:00:00Z', false],
    ['06:00 on the day summer time ends', '2026-10-25T05:00:00Z', true],
    ['05:00 on the day summer time ends', '2026-10-25T04:00:00Z', false],
  ])('treats %s as %s', (_case, isoDate, expected) => {
    expect(isWithinAwakeHours(new Date(isoDate))).toBe(expected);
  });
});

describe('keepApiAwake', () => {
  const fetchImplementation = vi.fn<FetchImplementation>();
  const sleep = vi.fn<KeepAwakeDependencies['sleep']>();

  const dependencies = (random = 0): KeepAwakeDependencies => ({
    fetchImplementation,
    random: () => random,
    sleep,
  });

  beforeEach(() => {
    fetchImplementation.mockResolvedValue(Response.json({ status: 'ok' }, { status: 200 }));
    sleep.mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it('calls the health check of the API after a random delay within the awake hours', async () => {
    await keepApiAwake({ API_ORIGIN }, WINTER_NOON, dependencies(0.5));

    expect(sleep).toHaveBeenCalledWith(MAXIMUM_DELAY_IN_MILLISECONDS / 2);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const [request] = fetchImplementation.mock.calls[0] ?? [];
    expect(request?.url).toBe(`${API_ORIGIN}/health`);
    expect(request?.method).toBe('GET');
    expect(sleep.mock.invocationCallOrder[0]).toBeLessThan(
      fetchImplementation.mock.invocationCallOrder[0] ?? 0
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it('waits at most four minutes', async () => {
    await keepApiAwake({ API_ORIGIN }, WINTER_NOON, dependencies(0.999_999));

    expect(MAXIMUM_DELAY_IN_MILLISECONDS).toBe(240_000);
    expect(sleep.mock.calls[0]?.[0]).toBeLessThan(MAXIMUM_DELAY_IN_MILLISECONDS);
  });

  it('gives the health check time for a cold start', async () => {
    const timeoutController = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeoutController.signal);

    await keepApiAwake({ API_ORIGIN }, WINTER_NOON, dependencies());

    expect(timeout).toHaveBeenCalledWith(HEALTH_CHECK_TIMEOUT_IN_MILLISECONDS);
    const requestSignal = fetchImplementation.mock.calls[0]?.[0].signal;
    expect(requestSignal?.aborted).toBe(false);
    timeoutController.abort();
    expect(requestSignal?.aborted).toBe(true);
  });

  it('lets the API sleep at night', async () => {
    await keepApiAwake({ API_ORIGIN }, new Date('2026-01-15T02:00:00Z'), dependencies());

    expect(sleep).not.toHaveBeenCalled();
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', {}],
    ['http on a public host', { API_ORIGIN: 'http://api.example.com' }],
  ])('logs instead of calling the API when API_ORIGIN is %s', async (_case, environment) => {
    await keepApiAwake(environment, WINTER_NOON, dependencies());

    expect(fetchImplementation).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('logs a failed request instead of throwing', async () => {
    const failure = new TypeError('Network connection lost.');
    fetchImplementation.mockRejectedValue(failure);

    await expect(
      keepApiAwake({ API_ORIGIN }, WINTER_NOON, dependencies())
    ).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(API_ORIGIN), failure);
  });

  it('logs an unsuccessful health check', async () => {
    fetchImplementation.mockResolvedValue(new Response(null, { status: 503 }));

    await keepApiAwake({ API_ORIGIN }, WINTER_NOON, dependencies());

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('503'));
  });
});

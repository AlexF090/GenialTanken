import { readFileSync } from 'node:fs';
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
/** Render stops an instance after 15 idle minutes; the calls keep a safety margin to that. */
const MAXIMUM_GAP_BETWEEN_CALLS_IN_MILLISECONDS = 12 * 60 * 1000;
const MILLISECONDS_PER_MINUTE = 60 * 1000;

const cronIntervalInMinutes = (): number => {
  const configuration = readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8');
  const match = /"crons":\s*\[\s*"\*\/(\d+) \* \* \* \*"\s*\]/.exec(configuration);
  if (match?.[1] === undefined) {
    throw new Error('Expected one cron trigger of the form */<minutes> * * * * in wrangler.jsonc.');
  }
  return Number(match[1]);
};

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

  let currentTime = WINTER_NOON;

  const dependencies = (random = 0): KeepAwakeDependencies => ({
    fetchImplementation,
    now: () => currentTime,
    random: () => random,
    sleep,
  });

  const passTime = (durationInMilliseconds: number): Promise<void> => {
    currentTime = new Date(currentTime.getTime() + durationInMilliseconds);
    return Promise.resolve();
  };

  const runAt = (isoDate: string, random = 0): Promise<void> => {
    currentTime = new Date(isoDate);
    return keepApiAwake({ API_ORIGIN }, dependencies(random));
  };

  beforeEach(() => {
    fetchImplementation.mockResolvedValue(Response.json({ status: 'ok' }, { status: 200 }));
    currentTime = WINTER_NOON;
    sleep.mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it('calls the health check of the API after a random delay within the awake hours', async () => {
    await keepApiAwake({ API_ORIGIN }, dependencies(0.5));

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

  it('waits less than two minutes', async () => {
    await keepApiAwake({ API_ORIGIN }, dependencies(0.999_999));

    expect(MAXIMUM_DELAY_IN_MILLISECONDS).toBe(120_000);
    expect(sleep.mock.calls[0]?.[0]).toBeLessThan(MAXIMUM_DELAY_IN_MILLISECONDS);
  });

  it('keeps calls at most twelve minutes apart even when one cron run is skipped', () => {
    const gapWithOneSkippedRun =
      2 * cronIntervalInMinutes() * MILLISECONDS_PER_MINUTE + MAXIMUM_DELAY_IN_MILLISECONDS;

    expect(gapWithOneSkippedRun).toBeLessThanOrEqual(MAXIMUM_GAP_BETWEEN_CALLS_IN_MILLISECONDS);
  });

  it('gives the health check time for a cold start', async () => {
    const timeoutController = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeoutController.signal);

    await keepApiAwake({ API_ORIGIN }, dependencies());

    expect(timeout).toHaveBeenCalledWith(HEALTH_CHECK_TIMEOUT_IN_MILLISECONDS);
    const requestSignal = fetchImplementation.mock.calls[0]?.[0].signal;
    expect(requestSignal?.aborted).toBe(false);
    timeoutController.abort();
    expect(requestSignal?.aborted).toBe(true);
  });

  it('lets the API sleep at night without waiting', async () => {
    await runAt('2026-01-15T02:00:00Z');

    expect(sleep).not.toHaveBeenCalled();
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('checks the awake hours at the time of the call, after the delay', async () => {
    sleep.mockImplementation(passTime);

    // 23:59 in Berlin; the delay of one minute and a half ends after midnight.
    await runAt('2026-01-15T22:59:00Z', 0.75);

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('calls the API when the delay ends within the awake hours', async () => {
    sleep.mockImplementation(passTime);

    // 05:59 in Berlin; the delay of one minute and a half ends after 06:00.
    await runAt('2026-01-15T04:59:00Z', 0.75);

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing', {}],
    ['http on a public host', { API_ORIGIN: 'http://api.example.com' }],
  ])('logs instead of calling the API when API_ORIGIN is %s', async (_case, environment) => {
    await keepApiAwake(environment, dependencies());

    expect(fetchImplementation).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('logs a failed request instead of throwing', async () => {
    const failure = new TypeError('Network connection lost.');
    fetchImplementation.mockRejectedValue(failure);

    await expect(keepApiAwake({ API_ORIGIN }, dependencies())).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(API_ORIGIN), failure);
  });

  it('logs an unsuccessful health check', async () => {
    fetchImplementation.mockResolvedValue(new Response(null, { status: 503 }));

    await keepApiAwake({ API_ORIGIN }, dependencies());

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('503'));
  });
});

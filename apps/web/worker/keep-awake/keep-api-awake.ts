import { isAllowedApiOrigin } from '../api/api-origin.ts';
import type { ApiProxyEnvironment, FetchImplementation } from '../api/proxy-api-request.ts';

/**
 * The free Render instance sleeps after 15 minutes without traffic, and 750 instance hours a
 * month do not cover a whole month. So it is kept awake only from 06:00 to midnight in Berlin.
 */
const FIRST_AWAKE_HOUR = 6;
const LAST_AWAKE_HOUR = 23;
const AWAKE_HOURS_TIME_ZONE = 'Europe/Berlin';

/**
 * Spreads the calls of the cron trigger so they do not hit the API on the same second. With the
 * ten-minute cron, two calls are at most 12 minutes apart, below the 15 idle minutes of Render.
 */
export const MAXIMUM_DELAY_IN_MILLISECONDS = 2 * 60 * 1000;
/** A cold start of the API takes about a minute. */
export const HEALTH_CHECK_TIMEOUT_IN_MILLISECONDS = 90 * 1000;

/** The health check is served outside the `/api` prefix of the API. */
const HEALTH_CHECK_PATH = '/health';

const berlinHourFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: AWAKE_HOURS_TIME_ZONE,
  hour: 'numeric',
  hourCycle: 'h23',
});

export interface KeepAwakeDependencies {
  fetchImplementation: FetchImplementation;
  /** Returns a number in [0, 1), like `Math.random`. */
  random: () => number;
  sleep: (durationInMilliseconds: number) => Promise<void>;
}

export const isWithinAwakeHours = (date: Date): boolean => {
  const hour = Number(berlinHourFormat.format(date));
  return hour >= FIRST_AWAKE_HOUR && hour <= LAST_AWAKE_HOUR;
};

/** Calls the health check of the API during the awake hours; never throws, only logs. */
export const keepApiAwake = async (
  environment: ApiProxyEnvironment,
  scheduledTime: Date,
  dependencies: KeepAwakeDependencies
): Promise<void> => {
  if (!isWithinAwakeHours(scheduledTime)) {
    return;
  }
  const apiOrigin = environment.API_ORIGIN;
  if (!isAllowedApiOrigin(apiOrigin)) {
    console.error(
      'API_ORIGIN is missing or not an https URL (http only for localhost); cannot keep the API awake.'
    );
    return;
  }
  await dependencies.sleep(Math.floor(dependencies.random() * MAXIMUM_DELAY_IN_MILLISECONDS));
  const healthCheckUrl = new URL(HEALTH_CHECK_PATH, apiOrigin);
  try {
    const response = await dependencies.fetchImplementation(
      new Request(healthCheckUrl, {
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_IN_MILLISECONDS),
      })
    );
    // Only the wake-up matters; an unread body would keep the connection busy.
    await response.body?.cancel();
    if (!response.ok) {
      console.error(`Health check of the API at ${apiOrigin} answered ${String(response.status)}`);
    }
  } catch (error) {
    console.error(`Health check of the API at ${apiOrigin} failed`, error);
  }
};

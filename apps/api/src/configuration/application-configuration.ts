import { MILLISECONDS_PER_SECOND } from '@genialtanken/contracts';
import type { Environment } from './environment.js';

/**
 * Typed access to the validated environment; the only place that reads configuration.
 * Environment variables carry their unit in the name; every duration getter returns milliseconds.
 */
export class ApplicationConfiguration {
  constructor(private readonly environment: Environment) {}

  get franceFuelPricesBaseUrl(): string {
    return this.environment.FRANCE_FUEL_PRICES_BASE_URL;
  }

  get franceStationDetailsBaseUrl(): string {
    return this.environment.FRANCE_STATION_DETAILS_BASE_URL;
  }

  get franceStationDetailsCacheTimeToLiveInMilliseconds(): number {
    return (
      this.environment.FRANCE_STATION_DETAILS_CACHE_TIME_TO_LIVE_IN_SECONDS *
      MILLISECONDS_PER_SECOND
    );
  }

  /** Total time one station search may spend waiting for French station pages. */
  get franceStationDetailsTimeBudgetInMilliseconds(): number {
    return this.environment.FRANCE_STATION_DETAILS_TIME_BUDGET_IN_MILLISECONDS;
  }

  get franceSearchedRecordsMaximumEntries(): number {
    return this.environment.FRANCE_SEARCHED_RECORDS_MAXIMUM_ENTRIES;
  }

  get photonBaseUrl(): string {
    return this.environment.PHOTON_BASE_URL;
  }

  get placesCacheTimeToLiveInMilliseconds(): number {
    return this.environment.PLACES_CACHE_TIME_TO_LIVE_IN_SECONDS * MILLISECONDS_PER_SECOND;
  }

  get webOrigins(): string[] {
    return this.environment.WEB_ORIGIN;
  }

  get port(): number {
    return this.environment.PORT;
  }

  get upstreamTimeoutInMilliseconds(): number {
    return this.environment.UPSTREAM_TIMEOUT_IN_MILLISECONDS;
  }

  get cacheTimeToLiveInMilliseconds(): number {
    return this.environment.CACHE_TIME_TO_LIVE_IN_SECONDS * MILLISECONDS_PER_SECOND;
  }

  get cacheMaximumEntries(): number {
    return this.environment.CACHE_MAXIMUM_ENTRIES;
  }

  get rateLimitRequestsPerMinute(): number {
    return this.environment.RATE_LIMIT_REQUESTS_PER_MINUTE;
  }

  /** `undefined` when the client address header of the Cloudflare Worker is ignored. */
  get proxySharedSecret(): string | undefined {
    return this.environment.PROXY_SHARED_SECRET;
  }
}

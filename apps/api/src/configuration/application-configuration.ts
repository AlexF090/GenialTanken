import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from './environment.js';

/** Durations are configured in seconds and used in milliseconds; converted only here. */
const MILLISECONDS_PER_SECOND = 1000;

/** Typed, validated access to the environment; the only place that reads configuration. */
@Injectable()
export class ApplicationConfiguration {
  constructor(private readonly configService: ConfigService<Environment, true>) {}

  get franceFuelPricesBaseUrl(): string {
    return this.configService.get('FRANCE_FUEL_PRICES_BASE_URL', { infer: true });
  }

  get franceStationDetailsBaseUrl(): string {
    return this.configService.get('FRANCE_STATION_DETAILS_BASE_URL', { infer: true });
  }

  get franceStationDetailsCacheTimeToLiveInMilliseconds(): number {
    return (
      this.configService.get('FRANCE_STATION_DETAILS_CACHE_TIME_TO_LIVE_IN_SECONDS', {
        infer: true,
      }) * MILLISECONDS_PER_SECOND
    );
  }

  /** Total time one station search may spend waiting for French station pages. */
  get franceStationDetailsTimeBudgetInMilliseconds(): number {
    return this.configService.get('FRANCE_STATION_DETAILS_TIME_BUDGET_IN_MILLISECONDS', {
      infer: true,
    });
  }

  get photonBaseUrl(): string {
    return this.configService.get('PHOTON_BASE_URL', { infer: true });
  }

  get placesCacheTimeToLiveInMilliseconds(): number {
    return (
      this.configService.get('PLACES_CACHE_TIME_TO_LIVE_IN_SECONDS', { infer: true }) *
      MILLISECONDS_PER_SECOND
    );
  }

  get webOrigins(): string[] {
    return this.configService.get('WEB_ORIGIN', { infer: true });
  }

  get port(): number {
    return this.configService.get('PORT', { infer: true });
  }

  get upstreamTimeoutInMilliseconds(): number {
    return this.configService.get('UPSTREAM_TIMEOUT_IN_MILLISECONDS', { infer: true });
  }

  get cacheTimeToLiveInMilliseconds(): number {
    return (
      this.configService.get('CACHE_TIME_TO_LIVE_IN_SECONDS', { infer: true }) *
      MILLISECONDS_PER_SECOND
    );
  }

  get cacheMaximumEntries(): number {
    return this.configService.get('CACHE_MAXIMUM_ENTRIES', { infer: true });
  }

  get rateLimitRequestsPerMinute(): number {
    return this.configService.get('RATE_LIMIT_REQUESTS_PER_MINUTE', { infer: true });
  }

  /** `undefined` when the client address header of the Cloudflare Worker is ignored. */
  get proxySharedSecret(): string | undefined {
    return this.configService.get('PROXY_SHARED_SECRET', { infer: true });
  }
}

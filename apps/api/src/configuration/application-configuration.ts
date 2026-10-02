import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from './environment.js';

/** Typed, validated access to the environment; the only place that reads configuration. */
@Injectable()
export class ApplicationConfiguration {
  constructor(private readonly configService: ConfigService<Environment, true>) {}

  get franceFuelPricesBaseUrl(): string {
    return this.configService.get('FRANCE_FUEL_PRICES_BASE_URL', { infer: true });
  }

  /** `undefined` when the German provider is disabled. */
  get tankenTankenApiKey(): string | undefined {
    return this.configService.get('TANKENTANKEN_API_KEY', { infer: true });
  }

  get tankenTankenBaseUrl(): string {
    return this.configService.get('TANKENTANKEN_BASE_URL', { infer: true });
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

  get cacheTimeToLiveInSeconds(): number {
    return this.configService.get('CACHE_TIME_TO_LIVE_IN_SECONDS', { infer: true });
  }

  get rateLimitRequestsPerMinute(): number {
    return this.configService.get('RATE_LIMIT_REQUESTS_PER_MINUTE', { infer: true });
  }

  get trustedProxyHops(): number {
    return this.configService.get('TRUSTED_PROXY_HOPS', { infer: true });
  }
}

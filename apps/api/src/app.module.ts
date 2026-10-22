import { createKeyv } from '@cacheable/memory';
import { MILLISECONDS_PER_MINUTE } from '@genialtanken/contracts';
import { CacheModule } from '@nestjs/cache-manager';
import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ApiErrorFilter } from './common/api-error.filter.js';
import { ApplicationConfiguration } from './configuration/application-configuration.js';
import { ConfigurationModule } from './configuration/configuration.module.js';
import type { EnvironmentVariables } from './configuration/environment.js';
import { HealthModule } from './health/health.module.js';
import { PlacesModule } from './places/places.module.js';
import { ClientAddressThrottlerGuard } from './rate-limit/client-address-throttler.guard.js';
import { StationsModule } from './stations/stations.module.js';

@Module({})
export class AppModule {
  /** Tests pass their own variables instead of changing `process.env`. */
  static forRoot(variables: EnvironmentVariables = process.env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigurationModule.forRoot(variables),
        CacheModule.registerAsync({
          isGlobal: true,
          inject: [ApplicationConfiguration],
          // The default Keyv store is an unbounded Map; the LRU store caps the memory use.
          useFactory: (configuration: ApplicationConfiguration) => {
            const timeToLive = configuration.cacheTimeToLiveInMilliseconds;
            return {
              ttl: timeToLive,
              stores: [createKeyv({ ttl: timeToLive, lruSize: configuration.cacheMaximumEntries })],
            };
          },
        }),
        ThrottlerModule.forRootAsync({
          inject: [ApplicationConfiguration],
          useFactory: (configuration: ApplicationConfiguration) => [
            { ttl: MILLISECONDS_PER_MINUTE, limit: configuration.rateLimitRequestsPerMinute },
          ],
        }),
        HealthModule,
        StationsModule,
        PlacesModule,
      ],
      providers: [
        { provide: APP_PIPE, useValue: new StandardSchemaValidationPipe() },
        { provide: APP_GUARD, useClass: ClientAddressThrottlerGuard },
        { provide: APP_FILTER, useClass: ApiErrorFilter },
      ],
    };
  }
}

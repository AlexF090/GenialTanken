import { CacheModule } from '@nestjs/cache-manager';
import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ApiErrorFilter } from './common/api-error.filter.js';
import { ApplicationConfiguration } from './configuration/application-configuration.js';
import { ConfigurationModule } from './configuration/configuration.module.js';
import { HealthModule } from './health/health.module.js';
import { ClientAddressThrottlerGuard } from './rate-limit/client-address-throttler.guard.js';
import { StationsModule } from './stations/stations.module.js';

const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_SECOND = 1000;

@Module({})
export class AppModule {
  /** Builds the module from the current environment; call it after the environment is set. */
  static forRoot(): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigurationModule.forRoot(),
        CacheModule.registerAsync({
          isGlobal: true,
          inject: [ApplicationConfiguration],
          useFactory: (configuration: ApplicationConfiguration) => ({
            ttl: configuration.cacheTimeToLiveInSeconds * MILLISECONDS_PER_SECOND,
          }),
        }),
        ThrottlerModule.forRootAsync({
          inject: [ApplicationConfiguration],
          useFactory: (configuration: ApplicationConfiguration) => [
            { ttl: MILLISECONDS_PER_MINUTE, limit: configuration.rateLimitRequestsPerMinute },
          ],
        }),
        HealthModule,
        StationsModule,
      ],
      providers: [
        { provide: APP_PIPE, useValue: new StandardSchemaValidationPipe() },
        { provide: APP_GUARD, useClass: ClientAddressThrottlerGuard },
        { provide: APP_FILTER, useClass: ApiErrorFilter },
      ],
    };
  }
}

import { Global, Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { APPLICATION_VERSION, readApplicationVersion } from '../common/application-version.js';
import { ApplicationConfiguration } from './application-configuration.js';
import { parseEnvironment } from './environment.js';
import type { EnvironmentVariables } from './environment.js';

@Global()
@Module({})
export class ConfigurationModule {
  /** Validates the variables when called, so the application fails fast on bad values. */
  static forRoot(variables: EnvironmentVariables): DynamicModule {
    return {
      module: ConfigurationModule,
      providers: [
        {
          provide: ApplicationConfiguration,
          useValue: new ApplicationConfiguration(parseEnvironment(variables)),
        },
        { provide: APPLICATION_VERSION, useValue: readApplicationVersion() },
      ],
      exports: [ApplicationConfiguration, APPLICATION_VERSION],
    };
  }
}

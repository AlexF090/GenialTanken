import { Global, Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApplicationConfiguration } from './application-configuration.js';
import { environmentSchema } from './environment.js';

@Global()
@Module({})
export class ConfigurationModule {
  /** Reads and validates `process.env` when called, so the application fails fast on bad values. */
  static forRoot(): DynamicModule {
    return {
      module: ConfigurationModule,
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          // Read validated values only, so optional variables never fall back to raw strings
          skipProcessEnv: true,
          validationSchema: environmentSchema,
        }),
      ],
      providers: [ApplicationConfiguration],
      exports: [ApplicationConfiguration],
    };
  }
}

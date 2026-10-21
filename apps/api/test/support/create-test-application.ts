import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/configure-application.js';

/** Variables to set for the application; `undefined` removes a variable. */
export type EnvironmentOverrides = Record<string, string | undefined>;

const applyEnvironment = (overrides: EnvironmentOverrides): (() => void) => {
  const originalEnvironment = { ...process.env };
  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, name);
    } else {
      process.env[name] = value;
    }
  }

  return () => {
    for (const name of Object.keys(process.env)) {
      if (!(name in originalEnvironment)) {
        Reflect.deleteProperty(process.env, name);
      }
    }
    Object.assign(process.env, originalEnvironment);
  };
};

/**
 * Boots the real application the same way `main.ts` does, configured through the environment.
 * French station names are only looked up when the overrides name a station details server.
 */
export const createTestApplication = async (
  overrides: EnvironmentOverrides
): Promise<NestExpressApplication> => {
  const restoreEnvironment = applyEnvironment({
    // A closed local port: tests never reach the real website, and names stay missing unless a
    // test points this at a fake.
    FRANCE_STATION_DETAILS_BASE_URL: 'http://127.0.0.1:9',
    ...overrides,
  });
  try {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule.forRoot()],
    }).compile();
    const application = testingModule.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configureApplication(application);
    await application.init();
    return application;
  } finally {
    restoreEnvironment();
  }
};

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/configure-application.js';

export const GERMAN_TEST_API_KEY = 'german-test-api-key';

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
 * The German provider stays disabled unless the overrides set its API key.
 */
export const createTestApplication = async (
  overrides: EnvironmentOverrides
): Promise<NestExpressApplication> => {
  const restoreEnvironment = applyEnvironment({
    TANKENTANKEN_API_KEY: undefined,
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

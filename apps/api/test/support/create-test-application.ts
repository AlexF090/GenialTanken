import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/configure-application.js';
import type { EnvironmentVariables } from '../../src/configuration/environment.js';

/**
 * Boots the real application the same way `main.ts` does, configured by the given variables
 * instead of `process.env`. French station names are only looked up when the variables name a
 * station details server.
 */
export const createTestApplication = async (
  variables: EnvironmentVariables
): Promise<NestExpressApplication> => {
  const testingModule = await Test.createTestingModule({
    imports: [
      AppModule.forRoot({
        // A closed local port: tests never reach the real website, and names stay missing unless
        // a test points this at a fake.
        FRANCE_STATION_DETAILS_BASE_URL: 'http://127.0.0.1:9',
        ...variables,
      }),
    ],
  }).compile();
  const application = testingModule.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  configureApplication(application);
  await application.init();
  return application;
};

export type TestApi = ReturnType<typeof request>;

/**
 * Starts the application for a test and closes it afterwards. `defaultVariables` is read at
 * start, so it can name fake upstreams started in `beforeEach`.
 */
export const useTestApplication = (
  defaultVariables: () => EnvironmentVariables = () => ({})
): ((variables?: EnvironmentVariables) => Promise<TestApi>) => {
  let application: NestExpressApplication | undefined;
  afterEach(async () => {
    await application?.close();
    application = undefined;
  });
  return async (variables = {}) => {
    application = await createTestApplication({ ...defaultVariables(), ...variables });
    return request(application.getHttpServer());
  };
};

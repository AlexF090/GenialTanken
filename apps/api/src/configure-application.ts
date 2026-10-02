import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { ApplicationConfiguration } from './configuration/application-configuration.js';
import { createOpenApiDocument } from './openapi/create-openapi-document.js';

export const API_PREFIX = 'api';

/** HTTP setup shared by `main.ts` and the end-to-end tests. */
export const configureApplication = (application: NestExpressApplication): void => {
  const configuration = application.get(ApplicationConfiguration);

  // Render terminates TLS in one proxy hop; the rate limit needs the client IP behind it
  application.set('trust proxy', 1);
  application.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  application.enableCors({ origin: configuration.webOrigins });
  SwaggerModule.setup(`${API_PREFIX}/docs`, application, () => createOpenApiDocument(application));
};

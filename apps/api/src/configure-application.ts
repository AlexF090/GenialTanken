import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { ApplicationConfiguration } from './configuration/application-configuration.js';
import { createOpenApiDocument } from './openapi/create-openapi-document.js';

const API_PREFIX = 'api';
const TRUSTED_PROXY_HOPS = 1;

/** HTTP setup shared by `main.ts` and the end-to-end tests. */
export const configureApplication = (application: NestExpressApplication): void => {
  const configuration = application.get(ApplicationConfiguration);

  // Only Render's own proxy is trusted; anyone can reach the Render URL directly and forge more
  // X-Forwarded-For entries. The Worker names the client via `ClientAddressThrottlerGuard`.
  application.set('trust proxy', TRUSTED_PROXY_HOPS);
  application.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  application.enableCors({ origin: configuration.webOrigins });
  SwaggerModule.setup(`${API_PREFIX}/docs`, application, () => createOpenApiDocument(application));
};

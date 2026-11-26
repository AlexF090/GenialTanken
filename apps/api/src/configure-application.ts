import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { ApplicationConfiguration } from './configuration/application-configuration.js';
import { createOpenApiDocument } from './openapi/create-openapi-document.js';

const API_PREFIX = 'api';
const TRUSTED_PROXY_HOPS = 1;
const PREFLIGHT_MAXIMUM_AGE_IN_SECONDS = 86_400;

/** HTTP setup shared by `main.ts` and the end-to-end tests. */
export const configureApplication = (application: NestExpressApplication): void => {
  const configuration = application.get(ApplicationConfiguration);

  // Browsers call the API directly. Exactly one proxy hop is trusted: Render's own, which appends
  // the address it saw to X-Forwarded-For. `request.ip` is that last entry, so entries a client
  // adds itself stay ignored and the rate limit cannot be dodged by forging the header.
  application.set('trust proxy', TRUSTED_PROXY_HOPS);
  application.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  // The web app is static and lives on another origin, so every request is cross-origin. The
  // preflight (it sends the custom `ngsw-bypass` header) may be cached for a day, which browsers
  // cap on their own.
  application.enableCors({
    origin: configuration.webOrigins,
    maxAge: PREFLIGHT_MAXIMUM_AGE_IN_SECONDS,
  });
  SwaggerModule.setup(`${API_PREFIX}/docs`, application, () => createOpenApiDocument(application));
};

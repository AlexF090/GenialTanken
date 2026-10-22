import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { APPLICATION_VERSION } from '../common/application-version.js';

export const createOpenApiDocument = (application: INestApplication): OpenAPIObject =>
  SwaggerModule.createDocument(
    application,
    new DocumentBuilder()
      .setTitle('GenialTanken API')
      .setDescription(
        'Backend-for-frontend that serves current fuel prices from French government open data.'
      )
      .setVersion(application.get<string>(APPLICATION_VERSION))
      .build()
  );

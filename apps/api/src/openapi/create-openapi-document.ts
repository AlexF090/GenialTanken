import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { readApplicationVersion } from '../common/application-version.js';

export const createOpenApiDocument = (application: INestApplication): OpenAPIObject =>
  SwaggerModule.createDocument(
    application,
    new DocumentBuilder()
      .setTitle('GenialTanken API')
      .setDescription(
        'Backend-for-frontend that merges current fuel prices from French government open data and, optionally, the German tankentanken API.'
      )
      .setVersion(readApplicationVersion())
      .build()
  );

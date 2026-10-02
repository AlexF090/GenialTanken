import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';

export const createOpenApiDocument = (application: INestApplication): OpenAPIObject =>
  SwaggerModule.createDocument(
    application,
    new DocumentBuilder()
      .setTitle('GenialTanken API')
      .setDescription('Backend-for-frontend in front of the tankentanken fuel price API.')
      .setVersion('1.0.0')
      .build()
  );

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { z } from 'zod';

const packageManifestSchema = z.object({ version: z.string().min(1) });

/** Version from apps/api/package.json; the same relative path works from `src/` and `dist/`. */
const readApplicationVersion = (): string =>
  packageManifestSchema.parse(
    JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'package.json'), 'utf8'))
  ).version;

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

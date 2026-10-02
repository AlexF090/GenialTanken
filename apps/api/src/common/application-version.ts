import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const packageManifestSchema = z.object({ version: z.string().min(1) });

/** Version from apps/api/package.json; the same relative path works from `src/` and `dist/`. */
export const readApplicationVersion = (): string =>
  packageManifestSchema.parse(
    JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'package.json'), 'utf8'))
  ).version;

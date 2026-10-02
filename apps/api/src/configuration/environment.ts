import { z } from 'zod';

const positiveIntegerSchema = z.coerce.number().int().positive();

/** Environment variables of the API, validated once at startup. */
export const environmentSchema = z.object({
  FRANCE_FUEL_PRICES_BASE_URL: z
    .url()
    .default('https://data.economie.gouv.fr')
    .transform(url => url.replace(/\/+$/, '')),
  /** Enables the German provider; without it only French stations are served. */
  TANKENTANKEN_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform(apiKey => (apiKey === '' ? undefined : apiKey)),
  TANKENTANKEN_BASE_URL: z
    .url()
    .default('https://api.tankentanken.de')
    .transform(url => url.replace(/\/+$/, '')),
  WEB_ORIGIN: z
    .string()
    .default('http://localhost:4200')
    .transform(origins =>
      origins
        .split(',')
        .map(origin => origin.trim())
        .filter(origin => origin.length > 0)
    )
    .pipe(z.array(z.url()).min(1, 'must list at least one origin')),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  UPSTREAM_TIMEOUT_IN_MILLISECONDS: positiveIntegerSchema.default(8000),
  CACHE_TIME_TO_LIVE_IN_SECONDS: positiveIntegerSchema.default(300),
  RATE_LIMIT_REQUESTS_PER_MINUTE: positiveIntegerSchema.default(60),
  /** Reverse proxies in front of the API: 1 = Render only, 2 = Cloudflare Pages Function + Render. */
  TRUSTED_PROXY_HOPS: positiveIntegerSchema.default(1),
});

export type Environment = z.infer<typeof environmentSchema>;

import { z } from 'zod';

const positiveIntegerSchema = z.coerce.number().int().positive();
const MINIMUM_PROXY_SHARED_SECRET_LENGTH = 32;

/** Treats a blank value like an unset one, as hosting dashboards often store empty strings. */
const optionalTrimmedString = () =>
  z
    .string()
    .trim()
    .optional()
    .transform(value => (value === '' ? undefined : value));

/** Environment variables of the API, validated once at startup. */
export const environmentSchema = z.object({
  FRANCE_FUEL_PRICES_BASE_URL: z
    .url()
    .default('https://data.economie.gouv.fr')
    .transform(url => url.replace(/\/+$/, '')),
  /** Enables the German provider; without it only French stations are served. */
  TANKENTANKEN_API_KEY: optionalTrimmedString(),
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
  /**
   * Shared with the Cloudflare Pages Function; only requests carrying it may name the client
   * address for the rate limit. Without it every request is limited by its connecting address.
   */
  PROXY_SHARED_SECRET: optionalTrimmedString().pipe(
    z
      .string()
      .min(
        MINIMUM_PROXY_SHARED_SECRET_LENGTH,
        `must have at least ${String(MINIMUM_PROXY_SHARED_SECRET_LENGTH)} characters`
      )
      .optional()
  ),
});

export type Environment = z.infer<typeof environmentSchema>;

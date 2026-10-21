import { z } from 'zod';

const positiveIntegerSchema = z.coerce.number().int().positive();
const MINIMUM_PROXY_SHARED_SECRET_LENGTH = 32;

/** An absolute URL without trailing slashes, so paths can be appended directly. */
const baseUrlSchema = (defaultUrl: string) =>
  z
    .url()
    .default(defaultUrl)
    .transform(url => url.replace(/\/+$/, ''));

/** Treats a blank value like an unset one, as hosting dashboards often store empty strings. */
const optionalTrimmedString = () =>
  z
    .string()
    .trim()
    .optional()
    .transform(value => (value === '' ? undefined : value));

/** Environment variables of the API, validated once at startup. */
export const environmentSchema = z.object({
  FRANCE_FUEL_PRICES_BASE_URL: baseUrlSchema('https://data.economie.gouv.fr'),
  /**
   * Website of the French price service; the open data lacks station names and brands, its
   * station pages (HTML) have them.
   */
  FRANCE_STATION_DETAILS_BASE_URL: baseUrlSchema('https://www.prix-carburants.gouv.fr'),
  /** Names and brands rarely change, so they are cached far longer than fuel prices. */
  FRANCE_STATION_DETAILS_CACHE_TIME_TO_LIVE_IN_SECONDS: positiveIntegerSchema.default(604_800),
  /**
   * How long one station search may wait for station pages in total; stations whose page has
   * not arrived by then are served without name.
   */
  FRANCE_STATION_DETAILS_TIME_BUDGET_IN_MILLISECONDS: positiveIntegerSchema.default(3000),
  /** Photon (komoot) instance behind the place search. */
  PHOTON_BASE_URL: baseUrlSchema('https://photon.komoot.io'),
  /** Place search answers rarely change, so they are cached far longer than fuel prices. */
  PLACES_CACHE_TIME_TO_LIVE_IN_SECONDS: positiveIntegerSchema.default(86_400),
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
  /** Upper bound of the in-memory cache; the least recently used entries are evicted beyond it. */
  CACHE_MAXIMUM_ENTRIES: positiveIntegerSchema.default(5000),
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

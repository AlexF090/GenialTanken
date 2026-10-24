import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import type { z } from 'zod';
import { toCacheKey } from '../common/cache-key.js';
import { ApplicationConfiguration } from '../configuration/application-configuration.js';
import { NOT_FOUND_STATUS, requestUpstream, toUpstreamError } from './request-upstream.js';
import { UpstreamError } from './upstream-error.js';

export interface UpstreamRequest {
  url: URL;
  headers?: Record<string, string>;
  /** How long a successful answer stays cached; defaults to `CACHE_TIME_TO_LIVE_IN_SECONDS`. */
  cacheTimeToLiveInMilliseconds?: number;
  /** Lets the caller give up early; see `requestUpstream`. */
  signal?: AbortSignal;
}

export interface UpstreamJsonRequest<Schema extends z.ZodType> extends UpstreamRequest {
  /**
   * The cache is keyed by URL only and holds the parsed answer, so every request for one URL must
   * pass the same schema; a different schema would get the answer parsed by the first one.
   */
  schema: Schema;
}

/** An answer together with the time it came from the upstream, also when served from the cache. */
export interface UpstreamAnswer<Body> {
  body: Body;
  /** `Date.now()` when the upstream answered. */
  fetchedAt: number;
}

interface BodyFormat<Body> {
  accept: string;
  cacheNamespace: string;
  read: (response: Response) => Promise<Body>;
}

const TEXT_FORMAT: BodyFormat<string> = {
  accept: 'text/html, text/plain',
  cacheNamespace: 'upstream-text',
  read: response => response.text(),
};

/**
 * GETs data sources with timeout and caching per URL. Failures are never cached and surface as
 * `UpstreamError`; an abort through the caller's signal surfaces as `UpstreamAbortedError`.
 */
@Injectable()
export class UpstreamFetcher {
  constructor(
    private readonly configuration: ApplicationConfiguration,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {}

  /** Validates the answer with the schema; a 404 is a failure like any other. */
  async fetchJson<Schema extends z.ZodType>(
    request: UpstreamJsonRequest<Schema>
  ): Promise<z.infer<Schema>> {
    const { body } = await this.fetchJsonAnswer(request);
    return body;
  }

  /** Like `fetchJson`, for callers that must know how old a cached answer is. */
  async fetchJsonAnswer<Schema extends z.ZodType>({
    schema,
    ...request
  }: UpstreamJsonRequest<Schema>): Promise<UpstreamAnswer<z.infer<Schema>>> {
    const { pathname } = request.url;
    const answer = await this.fetchCached(request, {
      accept: 'application/json',
      cacheNamespace: 'upstream-json',
      read: async response => {
        const parsed = schema.safeParse(await response.json());
        if (!parsed.success) {
          throw new UpstreamError(
            `GET ${pathname} returned an unexpected payload: ${parsed.error.message}`
          );
        }
        return parsed.data;
      },
    });
    if (answer === undefined) {
      throw new UpstreamError(`GET ${pathname} responded with status ${String(NOT_FOUND_STATUS)}`);
    }
    return answer;
  }

  /** For data sources without a JSON API, e.g. HTML pages; resolves to `undefined` on 404. */
  async fetchText(request: UpstreamRequest): Promise<string | undefined> {
    const answer = await this.fetchCached(request, TEXT_FORMAT);
    return answer?.body;
  }

  private async fetchCached<Body>(
    {
      url,
      headers = {},
      cacheTimeToLiveInMilliseconds = this.configuration.cacheTimeToLiveInMilliseconds,
      signal,
    }: UpstreamRequest,
    { accept, cacheNamespace, read }: BodyFormat<Body>
  ): Promise<UpstreamAnswer<Body> | undefined> {
    const cacheKey = toCacheKey(cacheNamespace, url.toString());
    const cached = await this.cache.get<UpstreamAnswer<Body>>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const response = await requestUpstream(url, {
      accept,
      headers,
      timeoutInMilliseconds: this.configuration.upstreamTimeoutInMilliseconds,
      signal,
    });
    if (response === undefined) {
      return undefined;
    }
    const fetchedAt = Date.now();
    let body: Body;
    try {
      body = await read(response);
    } catch (error) {
      throw error instanceof UpstreamError ? error : toUpstreamError(url, error, signal);
    }

    const answer = { body, fetchedAt };
    await this.cache.set(cacheKey, answer, cacheTimeToLiveInMilliseconds);
    return answer;
  }
}

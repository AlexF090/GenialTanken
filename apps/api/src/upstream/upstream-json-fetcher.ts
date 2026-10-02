import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import type { z } from 'zod';
import { ApplicationConfiguration } from '../configuration/application-configuration.js';
import { UpstreamError } from './upstream-error.js';

const MILLISECONDS_PER_SECOND = 1000;
const NOT_FOUND_STATUS = 404;

export interface UpstreamJsonRequest<Schema extends z.ZodType> {
  url: URL;
  schema: Schema;
  headers?: Record<string, string>;
  /** How long a successful answer stays cached; defaults to `CACHE_TIME_TO_LIVE_IN_SECONDS`. */
  cacheTimeToLiveInMilliseconds?: number;
}

const describeFailure = (error: unknown): string => {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return 'timed out';
  }
  if (error instanceof SyntaxError) {
    return 'returned a body that is not JSON';
  }
  if (error instanceof Error) {
    return `failed: ${error.message}`;
  }
  return 'failed for an unknown reason';
};

/**
 * GETs JSON from a data source with timeout, response validation and caching per URL.
 * Failures are never cached and surface as `UpstreamError`.
 */
@Injectable()
export class UpstreamJsonFetcher {
  constructor(
    private readonly configuration: ApplicationConfiguration,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {}

  /** Resolves to `undefined` when the data source answers 404. */
  async fetch<Schema extends z.ZodType>({
    url,
    schema,
    headers = {},
    cacheTimeToLiveInMilliseconds = this.configuration.cacheTimeToLiveInSeconds *
      MILLISECONDS_PER_SECOND,
  }: UpstreamJsonRequest<Schema>): Promise<z.infer<Schema> | undefined> {
    const cacheKey = url.toString();
    const cached = await this.cache.get<z.infer<Schema>>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const body = await this.request(url, headers);
    if (body === undefined) {
      return undefined;
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new UpstreamError(
        `GET ${url.pathname} returned an unexpected payload: ${parsed.error.message}`
      );
    }

    await this.cache.set(cacheKey, parsed.data, cacheTimeToLiveInMilliseconds);
    return parsed.data;
  }

  /** Like `fetch`, but for resources that always exist: a 404 is a failure. */
  async fetchRequired<Schema extends z.ZodType>(
    upstreamJsonRequest: UpstreamJsonRequest<Schema>
  ): Promise<z.infer<Schema>> {
    const body = await this.fetch(upstreamJsonRequest);
    if (body === undefined) {
      throw new UpstreamError(
        `GET ${upstreamJsonRequest.url.pathname} responded with status ${String(NOT_FOUND_STATUS)}`
      );
    }
    return body;
  }

  private async request(url: URL, headers: Record<string, string>): Promise<unknown> {
    const signal = AbortSignal.timeout(this.configuration.upstreamTimeoutInMilliseconds);
    let response: Response;
    try {
      response = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal });
    } catch (error) {
      throw new UpstreamError(`GET ${url.pathname} ${describeFailure(error)}`);
    }

    if (response.status === NOT_FOUND_STATUS) {
      return undefined;
    }
    if (!response.ok) {
      throw new UpstreamError(
        `GET ${url.pathname} responded with status ${String(response.status)}`
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new UpstreamError(`GET ${url.pathname} ${describeFailure(error)}`);
    }
  }
}

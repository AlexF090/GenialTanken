import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { ApplicationConfiguration } from '../configuration/application-configuration.js';
import { requestUpstream, toUpstreamError } from './request-upstream.js';

export interface UpstreamTextRequest {
  url: URL;
  cacheTimeToLiveInMilliseconds: number;
  /** Lets the caller give up early; see `requestUpstream`. */
  signal?: AbortSignal;
}

/** Keeps text answers apart from JSON answers of the same URL in the shared cache. */
const CACHE_KEY_PREFIX = 'text:';

/**
 * GETs a text body (e.g. an HTML fragment) with timeout and caching per URL, for data sources
 * without a JSON API. Failures are never cached and surface as `UpstreamError`.
 */
@Injectable()
export class UpstreamTextFetcher {
  constructor(
    private readonly configuration: ApplicationConfiguration,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {}

  /** Resolves to `undefined` when the data source answers 404. */
  async fetch({
    url,
    cacheTimeToLiveInMilliseconds,
    signal,
  }: UpstreamTextRequest): Promise<string | undefined> {
    const cacheKey = `${CACHE_KEY_PREFIX}${url.toString()}`;
    const cached = await this.cache.get<string>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const response = await requestUpstream(url, {
      accept: 'text/html, text/plain',
      headers: {},
      timeoutInMilliseconds: this.configuration.upstreamTimeoutInMilliseconds,
      signal,
    });
    if (response === undefined) {
      return undefined;
    }
    let body: string;
    try {
      body = await response.text();
    } catch (error) {
      throw toUpstreamError(url, error, signal);
    }
    await this.cache.set(cacheKey, body, cacheTimeToLiveInMilliseconds);
    return body;
  }
}

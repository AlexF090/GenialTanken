import { Module } from '@nestjs/common';
import { UpstreamJsonFetcher } from './upstream-json-fetcher.js';
import { UpstreamTextFetcher } from './upstream-text-fetcher.js';

/** Shared access to external data sources (fuel prices, station names, place search). */
@Module({
  providers: [UpstreamJsonFetcher, UpstreamTextFetcher],
  exports: [UpstreamJsonFetcher, UpstreamTextFetcher],
})
export class UpstreamModule {}

import { Module } from '@nestjs/common';
import { UpstreamJsonFetcher } from './upstream-json-fetcher.js';

/** Shared access to external data sources (fuel prices, place search). */
@Module({
  providers: [UpstreamJsonFetcher],
  exports: [UpstreamJsonFetcher],
})
export class UpstreamModule {}

import { Module } from '@nestjs/common';
import { UpstreamFetcher } from './upstream-fetcher.js';

/** Shared access to external data sources (fuel prices, station names, place search). */
@Module({
  providers: [UpstreamFetcher],
  exports: [UpstreamFetcher],
})
export class UpstreamModule {}

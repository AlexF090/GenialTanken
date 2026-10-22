import { MILLISECONDS_PER_MINUTE } from '@genialtanken/contracts';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { toCacheKey } from '../../common/cache-key.js';
import { mapWithConcurrency } from '../../common/map-with-concurrency.js';
import { ApplicationConfiguration } from '../../configuration/application-configuration.js';
import { UpstreamAbortedError, UpstreamError } from '../../upstream/upstream-error.js';
import {
  MAXIMUM_PARALLEL_UPSTREAM_REQUESTS,
  UpstreamFetcher,
} from '../../upstream/upstream-fetcher.js';
import { frenchStationPagePath } from './french-upstream-paths.js';
import { parseFrenchStationIdentity } from './parse-french-station-identity.js';
import type { FrenchStationIdentity } from './parse-french-station-identity.js';

/**
 * How long a missing or failing station page is not asked again. Short, so a recovered page
 * gets its name back soon, yet a failing website does not slow down every search.
 */
const MISSING_STATION_IDENTITY_CACHE_TIME_TO_LIVE_IN_MILLISECONDS = 10 * MILLISECONDS_PER_MINUTE;

/**
 * Names and brands of French stations, which the open data lacks, from the station pages of the
 * price service's website.
 */
@Injectable()
export class FrenchStationIdentityLookup {
  private readonly logger = new Logger(FrenchStationIdentityLookup.name);

  constructor(
    private readonly configuration: ApplicationConfiguration,
    private readonly upstreamFetcher: UpstreamFetcher,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {}

  /**
   * Identities by local identifier; stations whose page is missing, failed or did not arrive
   * within `FRANCE_STATION_DETAILS_TIME_BUDGET_IN_MILLISECONDS` are left out.
   */
  async findIdentities(
    localIdentifiers: readonly number[]
  ): Promise<ReadonlyMap<number, FrenchStationIdentity>> {
    // One signal for all pages of a search, so the budget limits the search, not each page.
    const budget = AbortSignal.timeout(
      this.configuration.franceStationDetailsTimeBudgetInMilliseconds
    );
    const identities = await mapWithConcurrency(
      localIdentifiers,
      MAXIMUM_PARALLEL_UPSTREAM_REQUESTS,
      localIdentifier => this.findIdentity(localIdentifier, budget)
    );
    const identitiesByLocalIdentifier = new Map<number, FrenchStationIdentity>();
    identities.forEach((identity, index) => {
      const localIdentifier = localIdentifiers[index];
      if (identity !== undefined && localIdentifier !== undefined) {
        identitiesByLocalIdentifier.set(localIdentifier, identity);
      }
    });
    return identitiesByLocalIdentifier;
  }

  private async findIdentity(
    localIdentifier: number,
    budget: AbortSignal
  ): Promise<FrenchStationIdentity | undefined> {
    if (budget.aborted) {
      return undefined;
    }
    const missingIdentityCacheKey = toCacheKey(
      'france-missing-station-identity',
      String(localIdentifier)
    );
    if ((await this.cache.get<boolean>(missingIdentityCacheKey)) === true) {
      return undefined;
    }
    try {
      const html = await this.upstreamFetcher.fetchText({
        url: new URL(
          `${this.configuration.franceStationDetailsBaseUrl}${frenchStationPagePath(localIdentifier)}`
        ),
        cacheTimeToLiveInMilliseconds:
          this.configuration.franceStationDetailsCacheTimeToLiveInMilliseconds,
        signal: budget,
      });
      if (html !== undefined) {
        return parseFrenchStationIdentity(html);
      }
      this.logger.debug(`No page for French station ${String(localIdentifier)}`);
    } catch (error) {
      if (!(error instanceof UpstreamError)) {
        throw error;
      }
      this.logger.debug(`No name for French station ${String(localIdentifier)}: ${error.message}`);
      // The budget says nothing about the page; it may well answer for the next search.
      if (error instanceof UpstreamAbortedError) {
        return undefined;
      }
    }
    await this.cache.set(
      missingIdentityCacheKey,
      true,
      MISSING_STATION_IDENTITY_CACHE_TIME_TO_LIVE_IN_MILLISECONDS
    );
    return undefined;
  }
}

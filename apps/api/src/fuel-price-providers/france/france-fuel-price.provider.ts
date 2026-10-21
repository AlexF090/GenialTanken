import type { Station, StationsQuery } from '@genialtanken/contracts';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { ApplicationConfiguration } from '../../configuration/application-configuration.js';
import type { FuelPriceProvider } from '../fuel-price-provider.js';
import { roundCoordinate } from '../round-coordinate.js';
import { mapWithConcurrency } from '../../common/map-with-concurrency.js';
import { UpstreamAbortedError, UpstreamError } from '../../upstream/upstream-error.js';
import { UpstreamJsonFetcher } from '../../upstream/upstream-json-fetcher.js';
import { UpstreamTextFetcher } from '../../upstream/upstream-text-fetcher.js';
import { frenchRecordSchema, frenchRecordsResponseSchema } from './french-record.schema.js';
import type { FrenchRecord } from './french-record.schema.js';
import { parseFrenchStationIdentity } from './parse-french-station-identity.js';
import type { FrenchStationIdentity } from './parse-french-station-identity.js';
import { FRENCH_PRICE_FIELDS, toStationFromFrance } from './to-station-from-france.js';

const RECORDS_PATH =
  '/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';
const MAXIMUM_RECORDS_PER_REQUEST = 100;
const NUMERIC_IDENTIFIER_PATTERN = /^\d+$/;
const STATION_DETAILS_PATH = '/map/recuperer_infos_pdv/';
/** Station pages are fetched one per station; a few at once keeps it polite and still quick. */
const MAXIMUM_PARALLEL_STATION_DETAILS_REQUESTS = 8;
/**
 * How long a missing or failing station page is not asked again. Short, so a recovered page
 * gets its name back soon, yet a failing website does not slow down every search.
 */
const MISSING_STATION_IDENTITY_TIME_TO_LIVE_IN_MILLISECONDS = 10 * 60 * 1000;
const MISSING_STATION_IDENTITY_CACHE_KEY_PREFIX = 'france-station-identity-missing:';

/** French fuel prices from the government open data portal (no API key, 50,000 requests per day). */
@Injectable()
export class FranceFuelPriceProvider implements FuelPriceProvider {
  readonly country = 'FR';
  private readonly logger = new Logger(FranceFuelPriceProvider.name);

  constructor(
    private readonly configuration: ApplicationConfiguration,
    private readonly upstreamJsonFetcher: UpstreamJsonFetcher,
    private readonly upstreamTextFetcher: UpstreamTextFetcher,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {}

  async findStationsAround({
    latitude,
    longitude,
    radiusInKilometers,
    fuel,
  }: StationsQuery): Promise<Station[]> {
    // The dataset expects WKT points in longitude-latitude order
    const point = `geom'POINT(${roundCoordinate(longitude)} ${roundCoordinate(latitude)})'`;
    const records = await this.findRecords({
      where: `within_distance(geom, ${point}, ${String(radiusInKilometers)}km) and ${FRENCH_PRICE_FIELDS[fuel]} is not null`,
      order_by: `distance(geom, ${point})`,
      limit: String(MAXIMUM_RECORDS_PER_REQUEST),
    });
    const stationDetailsBudget = this.createStationDetailsBudget();
    return mapWithConcurrency(records, MAXIMUM_PARALLEL_STATION_DETAILS_REQUESTS, record =>
      this.toNamedStation(record, stationDetailsBudget)
    );
  }

  async findStationByIdentifier(localIdentifier: string): Promise<Station | null> {
    if (!NUMERIC_IDENTIFIER_PATTERN.test(localIdentifier)) {
      return null;
    }
    const [record] = await this.findRecords({ where: `id=${localIdentifier}`, limit: '1' });
    return record === undefined
      ? null
      : this.toNamedStation(record, this.createStationDetailsBudget());
  }

  /** One signal per search, shared by all its station page lookups. */
  private createStationDetailsBudget(): AbortSignal {
    return AbortSignal.timeout(this.configuration.franceStationDetailsTimeBudgetInMilliseconds);
  }

  /**
   * The open data has neither name nor brand; they come from the station page of the price
   * service's website. Without it the station keeps its address as title in the app, also when
   * the page has not arrived before the budget is spent.
   */
  private async toNamedStation(record: FrenchRecord, budget: AbortSignal): Promise<Station> {
    const station = toStationFromFrance(record);
    const identity = await this.findIdentity(record.id, budget);
    return identity === undefined ? station : { ...station, ...identity };
  }

  private async findIdentity(
    localIdentifier: number,
    budget: AbortSignal
  ): Promise<FrenchStationIdentity | undefined> {
    if (budget.aborted) {
      return undefined;
    }
    const missingIdentityCacheKey = `${MISSING_STATION_IDENTITY_CACHE_KEY_PREFIX}${String(localIdentifier)}`;
    if ((await this.cache.get<boolean>(missingIdentityCacheKey)) === true) {
      return undefined;
    }
    const url = new URL(
      `${this.configuration.franceStationDetailsBaseUrl}${STATION_DETAILS_PATH}${String(localIdentifier)}`
    );
    try {
      const html = await this.upstreamTextFetcher.fetch({
        url,
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
      MISSING_STATION_IDENTITY_TIME_TO_LIVE_IN_MILLISECONDS
    );
    return undefined;
  }

  private async findRecords(parameters: Record<string, string>): Promise<FrenchRecord[]> {
    const url = new URL(`${this.configuration.franceFuelPricesBaseUrl}${RECORDS_PATH}`);
    url.search = new URLSearchParams(parameters).toString();
    const response = await this.upstreamJsonFetcher.fetchRequired({
      url,
      schema: frenchRecordsResponseSchema,
    });

    const records = response.results.flatMap(result => {
      const parsed = frenchRecordSchema.safeParse(result);
      return parsed.success ? [parsed.data] : [];
    });
    const skippedRecords = response.results.length - records.length;
    if (skippedRecords > 0) {
      this.logger.warn(`Skipped ${String(skippedRecords)} malformed French fuel price records`);
    }
    return records;
  }
}

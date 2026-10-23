import type { Station, StationsQuery } from '@genialtanken/contracts';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { toCacheKey } from '../../common/cache-key.js';
import { ApplicationConfiguration } from '../../configuration/application-configuration.js';
import { UpstreamFetcher } from '../../upstream/upstream-fetcher.js';
import type { FuelPriceProvider } from '../fuel-price-provider.js';
import { roundCoordinate } from '../round-coordinate.js';
import { frenchRecordsResponseSchema, parseFrenchRecords } from './french-record.schema.js';
import type { FrenchRecord } from './french-record.schema.js';
import { FrenchStationIdentityLookup } from './french-station-identity-lookup.js';
import { FRENCH_RECORDS_PATH } from './french-upstream-paths.js';
import { FRENCH_PRICE_FIELDS, toStationFromFrance } from './to-station-from-france.js';

const MAXIMUM_RECORDS_PER_REQUEST = 100;
const NUMERIC_IDENTIFIER_PATTERN = /^\d+$/;
const SEARCHED_RECORD_CACHE_NAMESPACE = 'france-searched-record';

const toSearchedRecordCacheKey = (localIdentifier: number | string): string =>
  toCacheKey(SEARCHED_RECORD_CACHE_NAMESPACE, String(localIdentifier));

/** French fuel prices from the government open data portal (no API key, 50,000 requests per day). */
@Injectable()
export class FranceFuelPriceProvider implements FuelPriceProvider {
  readonly country = 'FR';
  private readonly logger = new Logger(FranceFuelPriceProvider.name);

  constructor(
    private readonly configuration: ApplicationConfiguration,
    private readonly upstreamFetcher: UpstreamFetcher,
    private readonly identityLookup: FrenchStationIdentityLookup,
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
    await this.rememberSearchedRecords(records);
    return this.toNamedStations(records);
  }

  async findStationByIdentifier(localIdentifier: string): Promise<Station | null> {
    if (!NUMERIC_IDENTIFIER_PATTERN.test(localIdentifier)) {
      return null;
    }
    // Opening a station from the list is the common case; the open data portal often needs
    // seconds for a query by identifier, while the search answered moments ago.
    const searchedRecord = await this.cache.get<FrenchRecord>(
      toSearchedRecordCacheKey(localIdentifier)
    );
    const records =
      searchedRecord === undefined
        ? await this.findRecords({ where: `id=${localIdentifier}`, limit: '1' })
        : [searchedRecord];
    const [station] = await this.toNamedStations(records);
    return station ?? null;
  }

  /** Kept as long as search answers, so a detail opened from the list shows the list's prices. */
  private async rememberSearchedRecords(records: readonly FrenchRecord[]): Promise<void> {
    await Promise.all(
      records.map(record =>
        this.cache.set(
          toSearchedRecordCacheKey(record.id),
          record,
          this.configuration.cacheTimeToLiveInMilliseconds
        )
      )
    );
  }

  /** A station without identity keeps its address as title in the app. */
  private async toNamedStations(records: readonly FrenchRecord[]): Promise<Station[]> {
    const identities = await this.identityLookup.findIdentities(records.map(record => record.id));
    return records.map(record => ({
      ...toStationFromFrance(record),
      ...identities.get(record.id),
    }));
  }

  private async findRecords(parameters: Record<string, string>): Promise<FrenchRecord[]> {
    const url = new URL(`${this.configuration.franceFuelPricesBaseUrl}${FRENCH_RECORDS_PATH}`);
    url.search = new URLSearchParams(parameters).toString();
    const response = await this.upstreamFetcher.fetchJson({
      url,
      schema: frenchRecordsResponseSchema,
    });

    const { records, skippedRecordCount } = parseFrenchRecords(response.results);
    if (skippedRecordCount > 0) {
      this.logger.warn(`Skipped ${String(skippedRecordCount)} malformed French fuel price records`);
    }
    return records;
  }
}

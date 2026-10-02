import type { Station, StationsQuery } from '@genialtanken/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { ApplicationConfiguration } from '../../configuration/application-configuration.js';
import type { FuelPriceProvider } from '../fuel-price-provider.js';
import { roundCoordinate } from '../round-coordinate.js';
import { UpstreamJsonFetcher } from '../../upstream/upstream-json-fetcher.js';
import { frenchRecordSchema, frenchRecordsResponseSchema } from './french-record.schema.js';
import type { FrenchRecord } from './french-record.schema.js';
import { FRENCH_PRICE_FIELDS, toStationFromFrance } from './to-station-from-france.js';

const RECORDS_PATH =
  '/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';
const MAXIMUM_RECORDS_PER_REQUEST = 100;
const NUMERIC_IDENTIFIER_PATTERN = /^\d+$/;

/** French fuel prices from the government open data portal (no API key, 50,000 requests per day). */
@Injectable()
export class FranceFuelPriceProvider implements FuelPriceProvider {
  readonly country = 'FR';
  private readonly logger = new Logger(FranceFuelPriceProvider.name);

  constructor(
    private readonly configuration: ApplicationConfiguration,
    private readonly upstreamJsonFetcher: UpstreamJsonFetcher
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
    return records.map(toStationFromFrance);
  }

  async findStationById(localIdentifier: string): Promise<Station | null> {
    if (!NUMERIC_IDENTIFIER_PATTERN.test(localIdentifier)) {
      return null;
    }
    const [record] = await this.findRecords({ where: `id=${localIdentifier}`, limit: '1' });
    return record === undefined ? null : toStationFromFrance(record);
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

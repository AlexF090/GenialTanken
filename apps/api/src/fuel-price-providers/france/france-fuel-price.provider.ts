import type { Station, StationsQuery } from '@genialtanken/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { ApplicationConfiguration } from '../../configuration/application-configuration.js';
import { UpstreamFetcher } from '../../upstream/upstream-fetcher.js';
import type { FuelPriceProvider } from '../fuel-price-provider.js';
import { roundCoordinate } from '../round-coordinate.js';
import { frenchRecordsResponseSchema, parseFrenchRecords } from './french-record.schema.js';
import { FrenchPriceSnapshot } from './french-price-snapshot.js';
import { FrenchStationIdentityLookup } from './french-station-identity-lookup.js';
import { FRENCH_RECORDS_PATH } from './french-upstream-paths.js';
import { selectNearestFrenchStations } from './select-nearest-french-stations.js';
import { FRENCH_PRICE_FIELDS, toFrenchStationEntry } from './to-station-from-france.js';
import type { FrenchStationEntry } from './to-station-from-france.js';

const MAXIMUM_STATIONS_PER_SEARCH = 100;
const NUMERIC_IDENTIFIER_PATTERN = /^\d+$/;

/**
 * French fuel prices from the government open data portal (no API key, 50,000 requests per day).
 * Answers from `FrenchPriceSnapshot`; only without a usable snapshot it queries the records.
 */
@Injectable()
export class FranceFuelPriceProvider implements FuelPriceProvider {
  readonly country = 'FR';
  private readonly logger = new Logger(FranceFuelPriceProvider.name);

  constructor(
    private readonly configuration: ApplicationConfiguration,
    private readonly upstreamFetcher: UpstreamFetcher,
    private readonly identityLookup: FrenchStationIdentityLookup,
    private readonly snapshot: FrenchPriceSnapshot
  ) {}

  async findStationsAround(query: StationsQuery): Promise<Station[]> {
    const snapshot = await this.snapshot.findUsableContent();
    const entries =
      snapshot === undefined
        ? await this.queryStationsAround(query)
        : selectNearestFrenchStations(snapshot.entries, query, MAXIMUM_STATIONS_PER_SEARCH);
    return this.toNamedStations(entries);
  }

  async findStationByIdentifier(localIdentifier: string): Promise<Station | null> {
    if (!NUMERIC_IDENTIFIER_PATTERN.test(localIdentifier)) {
      return null;
    }
    const snapshot = await this.snapshot.findUsableContent();
    const entry =
      snapshot === undefined
        ? (await this.queryRecords({ where: `id=${localIdentifier}`, limit: '1' }))[0]
        : snapshot.entriesByLocalIdentifier.get(Number(localIdentifier));
    if (entry === undefined) {
      return null;
    }
    const [station] = await this.toNamedStations([entry]);
    return station ?? null;
  }

  private async queryStationsAround({
    latitude,
    longitude,
    radiusInKilometers,
    fuel,
  }: StationsQuery): Promise<FrenchStationEntry[]> {
    // The dataset expects WKT points in longitude-latitude order
    const point = `geom'POINT(${roundCoordinate(longitude)} ${roundCoordinate(latitude)})'`;
    return this.queryRecords({
      where: `within_distance(geom, ${point}, ${String(radiusInKilometers)}km) and ${FRENCH_PRICE_FIELDS[fuel]} is not null`,
      order_by: `distance(geom, ${point})`,
      limit: String(MAXIMUM_STATIONS_PER_SEARCH),
    });
  }

  /** A station without identity keeps its address as title in the app. */
  private async toNamedStations(entries: readonly FrenchStationEntry[]): Promise<Station[]> {
    const identities = await this.identityLookup.findIdentities(
      entries.map(({ localIdentifier }) => localIdentifier)
    );
    return entries.map(({ localIdentifier, station }) => ({
      ...station,
      ...identities.get(localIdentifier),
    }));
  }

  private async queryRecords(parameters: Record<string, string>): Promise<FrenchStationEntry[]> {
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
    return records.map(toFrenchStationEntry);
  }
}

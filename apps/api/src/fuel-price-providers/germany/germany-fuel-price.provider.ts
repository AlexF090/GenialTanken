import type { FuelType, Station, StationsQuery } from '@genialtanken/contracts';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ApplicationConfiguration } from '../../configuration/application-configuration.js';
import { FuelPriceProviderError } from '../fuel-price-provider.js';
import type { FuelPriceProvider } from '../fuel-price-provider.js';
import { UpstreamJsonFetcher } from '../upstream-json-fetcher.js';
import {
  tankenTankenStationSchema,
  tankenTankenStationsSchema,
} from './tankentanken-station.schema.js';
import { toStationFromGermany } from './to-station-from-germany.js';

const METERS_PER_KILOMETER = 1000;
const STATIONS_PATH = '/gas-stations';
const OFFERED_FUEL_TYPES: readonly FuelType[] = ['e5', 'e10', 'diesel'];
const stationIdentifierSchema = z.guid();

/** German fuel prices from the tankentanken API; enabled only with an API key. */
@Injectable()
export class GermanyFuelPriceProvider implements FuelPriceProvider {
  readonly country = 'DE';

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
    if (!OFFERED_FUEL_TYPES.includes(fuel)) {
      return [];
    }

    const url = this.urlFor(STATIONS_PATH);
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      radius: String(Math.round(radiusInKilometers * METERS_PER_KILOMETER)),
    }).toString();
    const stations = await this.upstreamJsonFetcher.fetch({
      url,
      schema: tankenTankenStationsSchema,
      headers: this.authorizationHeaders(),
    });
    if (stations === undefined) {
      throw new FuelPriceProviderError(`GET ${url.pathname} responded with status 404`);
    }
    return stations.map(toStationFromGermany);
  }

  async findStationById(localIdentifier: string): Promise<Station | null> {
    if (!stationIdentifierSchema.safeParse(localIdentifier).success) {
      return null;
    }

    const station = await this.upstreamJsonFetcher.fetch({
      url: this.urlFor(`${STATIONS_PATH}/${localIdentifier}`),
      schema: tankenTankenStationSchema,
      headers: this.authorizationHeaders(),
    });
    return station === undefined ? null : toStationFromGermany(station);
  }

  private urlFor(path: string): URL {
    return new URL(`${this.configuration.tankenTankenBaseUrl}${path}`);
  }

  private authorizationHeaders(): Record<string, string> {
    const apiKey = this.configuration.tankenTankenApiKey;
    if (apiKey === undefined) {
      throw new FuelPriceProviderError('The tankentanken API key is not configured.');
    }
    return { Authorization: `Bearer ${apiKey}` };
  }
}

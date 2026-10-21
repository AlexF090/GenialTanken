import { METERS_PER_KILOMETER } from '@genialtanken/contracts';
import type { FuelType, Station, StationsQuery } from '@genialtanken/contracts';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ApplicationConfiguration } from '../../configuration/application-configuration.js';
import { FuelPriceProviderError } from '../fuel-price-provider.js';
import type { FuelPriceProvider } from '../fuel-price-provider.js';
import { roundCoordinate } from '../round-coordinate.js';
import { UpstreamJsonFetcher } from '../../upstream/upstream-json-fetcher.js';
import {
  tankenTankenStationSchema,
  tankenTankenStationsSchema,
} from './tankentanken-station.schema.js';
import { toStationFromGermany } from './to-station-from-germany.js';

// tankentanken documents no radius limit, but its website offers 1 to 25 km. Larger requests are
// capped; the StationsService filters by exact distance anyway.
const MAXIMUM_UPSTREAM_RADIUS_IN_KILOMETERS = 25;
const STATIONS_PATH = '/gas-stations';
const OFFERED_FUEL_TYPES: readonly FuelType[] = ['e5', 'e10', 'diesel'];
const tankenTankenStationGuidSchema = z.guid();

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
      latitude: roundCoordinate(latitude),
      longitude: roundCoordinate(longitude),
      radius: String(
        Math.round(
          Math.min(radiusInKilometers, MAXIMUM_UPSTREAM_RADIUS_IN_KILOMETERS) * METERS_PER_KILOMETER
        )
      ),
    }).toString();
    const stations = await this.upstreamJsonFetcher.fetchRequired({
      url,
      schema: tankenTankenStationsSchema,
      headers: this.authorizationHeaders(),
    });
    return stations.map(toStationFromGermany);
  }

  async findStationByIdentifier(localIdentifier: string): Promise<Station | null> {
    if (!tankenTankenStationGuidSchema.safeParse(localIdentifier).success) {
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

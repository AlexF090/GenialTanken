import type { Station, StationsQuery } from '@genialtanken/contracts';
import { BadGatewayException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ERROR_MESSAGES } from '../common/error-messages.js';
import {
  FUEL_PRICE_PROVIDERS,
  FuelPriceProviderError,
} from '../fuel-price-providers/fuel-price-provider.js';
import type { FuelPriceProvider } from '../fuel-price-providers/fuel-price-provider.js';
import {
  splitStationIdentifier,
  toCountryPrefix,
} from '../fuel-price-providers/station-identifier.js';

export const MAXIMUM_STATIONS_PER_RESPONSE = 100;

const byDistance = (first: Station, second: Station): number =>
  (first.distanceInMeters ?? Number.POSITIVE_INFINITY) -
  (second.distanceInMeters ?? Number.POSITIVE_INFINITY);

/** Combines the enabled fuel price providers into one country-independent station list. */
@Injectable()
export class StationsService {
  private readonly logger = new Logger(StationsService.name);

  constructor(
    @Inject(FUEL_PRICE_PROVIDERS) private readonly providers: readonly FuelPriceProvider[]
  ) {}

  /** Nearest stations with a price for the requested fuel; partial when some providers fail. */
  async findStationsAround(query: StationsQuery): Promise<Station[]> {
    const results = await Promise.allSettled(
      this.providers.map(provider => provider.findStationsAround(query))
    );

    const stations: Station[] = [];
    let succeededProviders = 0;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        succeededProviders += 1;
        stations.push(...result.value);
        return;
      }
      this.logProviderFailure(this.providers[index], result.reason);
    });
    if (succeededProviders === 0) {
      throw new BadGatewayException(ERROR_MESSAGES.upstreamUnavailable);
    }

    return stations
      .filter(station => station.pricesInEuro[query.fuel] !== null)
      .sort(byDistance)
      .slice(0, MAXIMUM_STATIONS_PER_RESPONSE);
  }

  /** Expects an identifier matching `STATION_IDENTIFIER_PATTERN`. */
  async findStationById(identifier: string): Promise<Station> {
    const { countryPrefix, localIdentifier } = splitStationIdentifier(identifier);
    const provider = this.providers.find(
      candidate => toCountryPrefix(candidate.country) === countryPrefix
    );
    if (provider === undefined) {
      throw new NotFoundException(ERROR_MESSAGES.stationNotFound);
    }

    let station: Station | null;
    try {
      station = await provider.findStationById(localIdentifier);
    } catch (error) {
      this.logProviderFailure(provider, error);
      throw new BadGatewayException(ERROR_MESSAGES.upstreamUnavailable);
    }
    if (station === null) {
      throw new NotFoundException(ERROR_MESSAGES.stationNotFound);
    }
    return station;
  }

  private logProviderFailure(provider: FuelPriceProvider | undefined, reason: unknown): void {
    const country = provider?.country ?? 'unknown';
    if (reason instanceof FuelPriceProviderError) {
      this.logger.warn(`Fuel price provider ${country} failed: ${reason.message}`);
      return;
    }
    this.logger.error(
      `Fuel price provider ${country} failed unexpectedly`,
      reason instanceof Error ? reason.stack : String(reason)
    );
  }
}

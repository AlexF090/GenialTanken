import { distanceInMeters, METERS_PER_KILOMETER } from '@genialtanken/contracts';
import type { Station, StationLookup, StationsQuery } from '@genialtanken/contracts';
import { BadGatewayException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ERROR_MESSAGES } from '../common/error-messages.js';
import { mapWithConcurrency } from '../common/map-with-concurrency.js';
import { FUEL_PRICE_PROVIDERS } from '../fuel-price-providers/fuel-price-provider.js';
import type { FuelPriceProvider } from '../fuel-price-providers/fuel-price-provider.js';
import {
  splitStationIdentifier,
  toCountryPrefix,
} from '../fuel-price-providers/station-identifier.js';
import { UpstreamError } from '../upstream/upstream-error.js';

export const MAXIMUM_STATIONS_PER_RESPONSE = 100;

/** Lookups running at once for one bulk request, to stay polite to the upstream sources. */
const MAXIMUM_PARALLEL_STATION_LOOKUPS = 8;

interface StationAtDistance {
  station: Station;
  exactDistanceInMeters: number;
}

interface RoutedStationIdentifier {
  /** `undefined` for a country without an enabled provider. */
  provider: FuelPriceProvider | undefined;
  localIdentifier: string;
}

type StationLookupOutcome =
  | { kind: 'found'; station: Station }
  | { kind: 'unavailable'; identifier: string }
  | { kind: 'failed'; identifier: string };

/** Combines the enabled fuel price providers into one country-independent station list. */
@Injectable()
export class StationsService {
  private readonly logger = new Logger(StationsService.name);

  constructor(
    @Inject(FUEL_PRICE_PROVIDERS) private readonly providers: readonly FuelPriceProvider[]
  ) {}

  /**
   * Nearest stations within the radius around the exact position with a price for the requested
   * fuel; partial when some providers fail.
   */
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

    const position = { latitude: query.latitude, longitude: query.longitude };
    const radiusInMeters = query.radiusInKilometers * METERS_PER_KILOMETER;
    return stations
      .filter(station => station.pricesInEuro[query.fuel] !== null)
      .map((station): StationAtDistance => ({
        station,
        exactDistanceInMeters: distanceInMeters(position, station.address),
      }))
      .filter(({ exactDistanceInMeters }) => exactDistanceInMeters <= radiusInMeters)
      .sort((first, second) => first.exactDistanceInMeters - second.exactDistanceInMeters)
      .slice(0, MAXIMUM_STATIONS_PER_RESPONSE)
      .map(({ station, exactDistanceInMeters }) => ({
        ...station,
        distanceInMeters: Math.round(exactDistanceInMeters),
      }));
  }

  /** Expects an identifier matching `STATION_IDENTIFIER_PATTERN`. */
  async findStationByIdentifier(identifier: string): Promise<Station> {
    const { provider, localIdentifier } = this.routeIdentifier(identifier);
    if (provider === undefined) {
      throw new NotFoundException(ERROR_MESSAGES.stationNotFound);
    }

    let station: Station | null;
    try {
      station = await provider.findStationByIdentifier(localIdentifier);
    } catch (error) {
      this.logProviderFailure(provider, error);
      throw new BadGatewayException(ERROR_MESSAGES.upstreamUnavailable);
    }
    if (station === null) {
      throw new NotFoundException(ERROR_MESSAGES.stationNotFound);
    }
    return station;
  }

  /**
   * Several stations at once, e.g. the favorites, in the requested order without repetitions.
   * Partial when some lookups fail; only when every lookup fails does it respond with 502.
   * Expects identifiers matching `STATION_IDENTIFIER_PATTERN`.
   */
  async findStationsByIdentifiers(identifiers: readonly string[]): Promise<StationLookup> {
    const uniqueIdentifiers = [...new Set(identifiers)];
    const outcomes = await mapWithConcurrency(
      uniqueIdentifiers,
      MAXIMUM_PARALLEL_STATION_LOOKUPS,
      identifier => this.lookUpStation(identifier)
    );

    const lookup: StationLookup = {
      stations: [],
      unavailableIdentifiers: [],
      failedIdentifiers: [],
    };
    for (const outcome of outcomes) {
      if (outcome.kind === 'found') {
        lookup.stations.push(outcome.station);
      } else if (outcome.kind === 'unavailable') {
        lookup.unavailableIdentifiers.push(outcome.identifier);
      } else {
        lookup.failedIdentifiers.push(outcome.identifier);
      }
    }
    if (
      lookup.failedIdentifiers.length > 0 &&
      lookup.failedIdentifiers.length === outcomes.length
    ) {
      throw new BadGatewayException(ERROR_MESSAGES.upstreamUnavailable);
    }
    return lookup;
  }

  private async lookUpStation(identifier: string): Promise<StationLookupOutcome> {
    const { provider, localIdentifier } = this.routeIdentifier(identifier);
    if (provider === undefined) {
      return { kind: 'unavailable', identifier };
    }
    try {
      const station = await provider.findStationByIdentifier(localIdentifier);
      return station === null ? { kind: 'unavailable', identifier } : { kind: 'found', station };
    } catch (error) {
      this.logProviderFailure(provider, error);
      return { kind: 'failed', identifier };
    }
  }

  /** The enabled provider for the country prefix of the identifier, if any. */
  private routeIdentifier(identifier: string): RoutedStationIdentifier {
    const { countryPrefix, localIdentifier } = splitStationIdentifier(identifier);
    const provider = this.providers.find(
      candidate => toCountryPrefix(candidate.country) === countryPrefix
    );
    return { provider, localIdentifier };
  }

  private logProviderFailure(provider: FuelPriceProvider | undefined, reason: unknown): void {
    const country = provider?.country ?? 'unknown';
    if (reason instanceof UpstreamError) {
      this.logger.warn(`Fuel price provider ${country} failed: ${reason.message}`);
      return;
    }
    this.logger.error(
      `Fuel price provider ${country} failed unexpectedly`,
      reason instanceof Error ? reason.stack : String(reason)
    );
  }
}

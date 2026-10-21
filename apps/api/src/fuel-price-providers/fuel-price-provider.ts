import type { CountryCode, Station, StationsQuery } from '@genialtanken/contracts';
import { UpstreamError } from '../upstream/upstream-error.js';

/** A source of fuel prices for one country. */
export interface FuelPriceProvider {
  readonly country: CountryCode;
  /**
   * Stations in about the requested area. `distanceInMeters` is left `null`: the caller computes
   * it from the exact position, the same way for every provider.
   */
  findStationsAround(query: StationsQuery): Promise<Station[]>;
  /** `null` when the provider does not know the station. */
  findStationByIdentifier(localIdentifier: string): Promise<Station | null>;
}

/** Injection token for the list of enabled `FuelPriceProvider`s. */
export const FUEL_PRICE_PROVIDERS = Symbol('FUEL_PRICE_PROVIDERS');

/** A provider cannot answer for a reason of its own, e.g. missing credentials. */
export class FuelPriceProviderError extends UpstreamError {
  override readonly name = 'FuelPriceProviderError';
}

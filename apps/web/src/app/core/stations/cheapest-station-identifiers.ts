import type { FuelType, Station } from '@genialtanken/contracts';
import { priceInEuro } from './station-display';

/**
 * Identifiers of all stations tied at the lowest price for the fuel type; empty when no station
 * reports a price for it.
 */
export const cheapestStationIdentifiers = (
  stations: readonly Station[],
  fuelType: FuelType
): ReadonlySet<string> => {
  const pricedStations = stations.flatMap(station => {
    const price = priceInEuro(station, fuelType);
    return price === null ? [] : [{ identifier: station.id, price }];
  });
  const lowestPrice = Math.min(...pricedStations.map(({ price }) => price));
  return new Set(
    pricedStations.filter(({ price }) => price === lowestPrice).map(({ identifier }) => identifier)
  );
};

import type { FuelType, Station } from '@genialtanken/contracts';
import { priceInEuro } from './station-display';

export type SortOrder = 'distance' | 'price';

/** Missing values sort after every known value. */
const ascendingWithMissingLast = (first: number | null, second: number | null): number =>
  (first ?? Number.POSITIVE_INFINITY) - (second ?? Number.POSITIVE_INFINITY) || 0;

/**
 * Stations in the given order without changing the input. Stations without a price for the fuel
 * type always go last, because the user cannot fill up there. The sort is stable, so ties keep
 * the order of the API response.
 */
export const sortStations = (
  stations: readonly Station[],
  sortOrder: SortOrder,
  fuelType: FuelType
): Station[] =>
  [...stations].sort((first, second) => {
    const firstPrice = priceInEuro(first, fuelType);
    const secondPrice = priceInEuro(second, fuelType);
    const priceAvailability = Number(firstPrice === null) - Number(secondPrice === null);
    if (priceAvailability !== 0) {
      return priceAvailability;
    }
    return sortOrder === 'price'
      ? ascendingWithMissingLast(firstPrice, secondPrice)
      : ascendingWithMissingLast(first.distanceInMeters, second.distanceInMeters);
  });

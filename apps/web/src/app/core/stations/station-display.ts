import type { FuelType, Station } from '@genialtanken/contracts';
import type { NavigationDestination } from '../navigation-apps/navigation-apps';

const hasText = (value: string | null): value is string => value !== null && value.trim() !== '';

/** "Wilhelmshöher Allee 100" — the house number is optional. */
export const formatStreetLine = (station: Station): string =>
  [station.address.street, station.address.houseNumber].filter(hasText).join(' ');

/** "34119 Kassel" */
export const formatCityLine = (station: Station): string =>
  [station.address.postalCode, station.address.city].filter(hasText).join(' ');

/** Brand, otherwise name, otherwise the address — French open data has neither brand nor name. */
export const stationTitle = (station: Station): string => {
  if (hasText(station.brand)) {
    return station.brand;
  }
  if (hasText(station.name)) {
    return station.name;
  }
  const streetLine = formatStreetLine(station);
  return streetLine === '' ? formatCityLine(station) : streetLine;
};

/** Name shown below the title; omitted when it would only repeat the title. */
export const stationSubtitle = (station: Station): string | undefined => {
  const title = stationTitle(station);
  return hasText(station.name) && station.name !== title ? station.name : undefined;
};

/** Price of one fuel type in euros, `null` when the station reports none. */
export const priceInEuro = (station: Station, fuelType: FuelType): number | null =>
  station.pricesInEuro[fuelType];

/** Where a navigation app should route to: the station's position, named like in the list. */
export const navigationDestinationOf = (station: Station): NavigationDestination => ({
  latitude: station.address.latitude,
  longitude: station.address.longitude,
  name: stationTitle(station),
});

import type { FuelType, Station } from '@genialtanken/contracts';
import type { NavigationDestination } from '../navigation-apps/navigation-apps';

const hasText = (value: string | null): value is string => value !== null && value.trim() !== '';

/** "Boulevard Vivier-Merle 19" — the house number is optional. */
export const formatStreetLine = (station: Station): string =>
  [station.address.street, station.address.houseNumber].filter(hasText).join(' ');

/** "69003 Lyon" */
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

/**
 * Address lines shown below the title: street and city, without the street when it already is
 * the title (stations without brand and name).
 */
export const addressLinesBelowTitle = (station: Station): string[] => {
  const title = stationTitle(station);
  return [formatStreetLine(station), formatCityLine(station)].filter(
    line => line !== '' && line !== title
  );
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

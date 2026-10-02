import type { Station } from '@genialtanken/contracts';
import { toStationIdentifier } from '../station-identifier.js';
import type { TankenTankenStation } from './tankentanken-station.schema.js';

export const toStationFromGermany = (station: TankenTankenStation): Station => {
  const { id, name, brand, address, fuelPrices, isOpen, openingTimes } = station;

  return {
    id: toStationIdentifier('DE', id),
    country: 'DE',
    name,
    brand,
    address,
    pricesInEuro: {
      e5: fuelPrices.e5?.price ?? null,
      e10: fuelPrices.e10?.price ?? null,
      superPlus: null,
      diesel: fuelPrices.diesel?.price ?? null,
      e85: null,
      lpg: null,
    },
    isOpen,
    openingTimes,
    distanceInMeters: null,
  };
};

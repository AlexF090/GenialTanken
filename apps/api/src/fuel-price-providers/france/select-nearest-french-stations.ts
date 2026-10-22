import { distanceInMeters, METERS_PER_KILOMETER } from '@genialtanken/contracts';
import type { StationsQuery } from '@genialtanken/contracts';
import type { FrenchStationEntry } from './to-station-from-france.js';

interface EntryAtDistance {
  entry: FrenchStationEntry;
  exactDistanceInMeters: number;
}

/** The nearest entries within the radius around the exact position that sell the fuel. */
export const selectNearestFrenchStations = (
  entries: readonly FrenchStationEntry[],
  { latitude, longitude, radiusInKilometers, fuel }: StationsQuery,
  maximumCount: number
): FrenchStationEntry[] => {
  const position = { latitude, longitude };
  const radiusInMeters = radiusInKilometers * METERS_PER_KILOMETER;
  return entries
    .filter(({ station }) => station.pricesInEuro[fuel] !== null)
    .map((entry): EntryAtDistance => ({
      entry,
      exactDistanceInMeters: distanceInMeters(position, entry.station.address),
    }))
    .filter(({ exactDistanceInMeters }) => exactDistanceInMeters <= radiusInMeters)
    .sort((first, second) => first.exactDistanceInMeters - second.exactDistanceInMeters)
    .slice(0, maximumCount)
    .map(({ entry }) => entry);
};

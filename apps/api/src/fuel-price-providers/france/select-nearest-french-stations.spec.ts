import type { StationsQuery } from '@genialtanken/contracts';
import type { FrenchRecord } from './french-record.schema.js';
import { selectNearestFrenchStations } from './select-nearest-french-stations.js';
import { toFrenchStationEntry } from './to-station-from-france.js';
import type { FrenchStationEntry } from './to-station-from-france.js';

const PARIS_SEARCH: StationsQuery = {
  latitude: 48.8566,
  longitude: 2.3522,
  radiusInKilometers: 5,
  fuel: 'e10',
};

const baseRecord: FrenchRecord = {
  id: 0,
  adresse: null,
  ville: 'Paris',
  cp: null,
  geom: { lon: 2.3522, lat: 48.8566 },
  horaires: null,
  gazole_prix: 1.9,
  sp95_prix: null,
  e10_prix: 1.8,
  sp98_prix: null,
  e85_prix: null,
  gplc_prix: null,
};

const entryAt = (
  id: number,
  geom: FrenchRecord['geom'],
  prices: Partial<FrenchRecord> = {}
): FrenchStationEntry => toFrenchStationEntry({ ...baseRecord, ...prices, id, geom });

/** About 4242 m from the search position. */
const vaugirard = entryAt(75015001, { lon: 2.3, lat: 48.84 });
/** About 2225 m from the search position. */
const rapee = entryAt(75012010, { lon: 2.373, lat: 48.842 });
/** About 5004 m north of the search position. */
const ordener = entryAt(75018003, { lon: 2.3522, lat: 48.9016 });
const withoutE10 = entryAt(75011002, { lon: 2.38, lat: 48.86 }, { e10_prix: null });

const localIdentifiersOf = (entries: readonly FrenchStationEntry[]) =>
  entries.map(({ localIdentifier }) => localIdentifier);

describe('selectNearestFrenchStations', () => {
  it('keeps the stations within the radius selling the fuel, nearest first', () => {
    const selected = selectNearestFrenchStations(
      [vaugirard, withoutE10, ordener, rapee],
      PARIS_SEARCH,
      100
    );

    expect(localIdentifiersOf(selected)).toEqual([75012010, 75015001]);
  });

  it('measures the radius from the exact position', () => {
    const selected = selectNearestFrenchStations(
      [ordener, rapee],
      { ...PARIS_SEARCH, radiusInKilometers: 5.01 },
      100
    );

    expect(localIdentifiersOf(selected)).toEqual([75012010, 75018003]);
  });

  it('keeps at most the requested number of stations', () => {
    const stationsDueNorth = Array.from({ length: 5 }, (_unused, index) =>
      entryAt(1000 + index, { lon: 2.3522, lat: 48.8566 + (5 - index) * 0.001 })
    );

    const selected = selectNearestFrenchStations(stationsDueNorth, PARIS_SEARCH, 2);

    expect(localIdentifiersOf(selected)).toEqual([1004, 1003]);
  });
});

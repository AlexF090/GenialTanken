import type { Station } from '@genialtanken/contracts';
import {
  carrefourStation,
  totalStation,
  unbrandedStation,
} from '../../../testing/station-fixtures';
import { sortStations } from './sort-stations';

const withPrices = (
  station: Station,
  pricesInEuro: Partial<Station['pricesInEuro']>,
  identifier: string = station.id
): Station => ({
  ...station,
  id: identifier,
  pricesInEuro: { ...station.pricesInEuro, ...pricesInEuro },
});

const withDistance = (station: Station, distanceInMeters: number | null): Station => ({
  ...station,
  distanceInMeters,
});

const identifiersOf = (stations: readonly Station[]): string[] =>
  stations.map(station => station.id);

describe('sortStations', () => {
  it('orders by ascending distance', () => {
    const sorted = sortStations(
      [unbrandedStation, totalStation, carrefourStation],
      'distance',
      'e5'
    );

    expect(identifiersOf(sorted)).toEqual([
      totalStation.id,
      carrefourStation.id,
      unbrandedStation.id,
    ]);
  });

  it('orders by ascending price of the selected fuel type', () => {
    const sorted = sortStations([totalStation, carrefourStation, unbrandedStation], 'price', 'e5');

    expect(identifiersOf(sorted)).toEqual([
      unbrandedStation.id,
      carrefourStation.id,
      totalStation.id,
    ]);
  });

  it('puts stations without a price for the fuel type last in both orders', () => {
    const stations = [unbrandedStation, totalStation, carrefourStation];

    expect(identifiersOf(sortStations(stations, 'price', 'e10'))).toEqual([
      carrefourStation.id,
      totalStation.id,
      unbrandedStation.id,
    ]);
    expect(identifiersOf(sortStations(stations, 'distance', 'e10'))).toEqual([
      totalStation.id,
      carrefourStation.id,
      unbrandedStation.id,
    ]);
  });

  it('keeps the input order for equal prices and equal distances', () => {
    const first = withPrices(totalStation, { e5: 1.7 }, 'fr-first');
    const second = withPrices(carrefourStation, { e5: 1.7 }, 'fr-second');
    const third = withPrices(unbrandedStation, { e5: 1.7 }, 'fr-third');

    expect(identifiersOf(sortStations([second, third, first], 'price', 'e5'))).toEqual([
      'fr-second',
      'fr-third',
      'fr-first',
    ]);
    expect(
      identifiersOf(
        sortStations([withDistance(second, 500), withDistance(first, 500)], 'distance', 'e5')
      )
    ).toEqual(['fr-second', 'fr-first']);
  });

  it('puts stations without a distance after those with one', () => {
    const sorted = sortStations(
      [withDistance(totalStation, null), withDistance(carrefourStation, 2000)],
      'distance',
      'e5'
    );

    expect(identifiersOf(sorted)).toEqual([carrefourStation.id, totalStation.id]);
  });

  it('does not change the given array', () => {
    const stations = [unbrandedStation, totalStation];

    sortStations(stations, 'distance', 'e5');

    expect(identifiersOf(stations)).toEqual([unbrandedStation.id, totalStation.id]);
  });
});

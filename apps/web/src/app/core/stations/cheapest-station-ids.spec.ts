import type { Station } from '@genialtanken/contracts';
import {
  carrefourStation,
  totalStation,
  unbrandedStation,
} from '../../../testing/station-fixtures';
import { cheapestStationIds } from './cheapest-station-ids';

const withE5Price = (station: Station, e5: number | null): Station => ({
  ...station,
  pricesInEuro: { ...station.pricesInEuro, e5 },
});

describe('cheapestStationIds', () => {
  it('contains the station with the lowest price for the fuel type', () => {
    const identifiers = cheapestStationIds(
      [totalStation, carrefourStation, unbrandedStation],
      'e5'
    );

    expect([...identifiers]).toEqual([unbrandedStation.id]);
  });

  it('contains every station tied at the lowest price', () => {
    const identifiers = cheapestStationIds(
      [withE5Price(totalStation, 1.799), carrefourStation, unbrandedStation],
      'e5'
    );

    expect([...identifiers]).toEqual([totalStation.id, unbrandedStation.id]);
  });

  it('ignores stations without a price for the fuel type', () => {
    const identifiers = cheapestStationIds([unbrandedStation, carrefourStation], 'e10');

    expect([...identifiers]).toEqual([carrefourStation.id]);
  });

  it('is empty when no station has a price or there are no stations', () => {
    expect(cheapestStationIds([unbrandedStation], 'e10').size).toBe(0);
    expect(cheapestStationIds([], 'e5').size).toBe(0);
  });
});

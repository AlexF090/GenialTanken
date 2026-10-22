import {
  carrefourStation,
  totalStation,
  unbrandedStation,
  withPrices,
} from '../../../testing/station-fixtures';
import { cheapestStationIdentifiers } from './cheapest-station-identifiers';

describe('cheapestStationIdentifiers', () => {
  it('contains the station with the lowest price for the fuel type', () => {
    const identifiers = cheapestStationIdentifiers(
      [totalStation, carrefourStation, unbrandedStation],
      'e5'
    );

    expect([...identifiers]).toEqual([unbrandedStation.id]);
  });

  it('contains every station tied at the lowest price', () => {
    const identifiers = cheapestStationIdentifiers(
      [withPrices(totalStation, { e5: 1.799 }), carrefourStation, unbrandedStation],
      'e5'
    );

    expect([...identifiers]).toEqual([totalStation.id, unbrandedStation.id]);
  });

  it('ignores stations without a price for the fuel type', () => {
    const identifiers = cheapestStationIdentifiers([unbrandedStation, carrefourStation], 'e10');

    expect([...identifiers]).toEqual([carrefourStation.id]);
  });

  it('is empty when no station has a price or there are no stations', () => {
    expect(cheapestStationIdentifiers([unbrandedStation], 'e10').size).toBe(0);
    expect(cheapestStationIdentifiers([], 'e5').size).toBe(0);
  });
});

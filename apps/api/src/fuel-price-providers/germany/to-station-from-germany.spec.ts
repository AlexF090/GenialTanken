import type { TankenTankenStation } from './tankentanken-station.schema.js';
import { toStationFromGermany } from './to-station-from-germany.js';

const OPENING_DAY = [{ opening: '07:00', closing: '21:00' }];

const OPENING_TIMES = {
  monday: OPENING_DAY,
  tuesday: OPENING_DAY,
  wednesday: OPENING_DAY,
  thursday: OPENING_DAY,
  friday: OPENING_DAY,
  saturday: [],
  sunday: [],
  publicHoliday: [],
};

const tankenTankenStation: TankenTankenStation = {
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Esso Kassel Süd',
  brand: 'Esso',
  address: {
    street: 'Frankfurter Straße',
    houseNumber: '210',
    postalCode: '34134',
    city: 'Kassel',
    latitude: 51.28,
    longitude: 9.46,
  },
  fuelPrices: {
    e5: { price: 1.899, lastChange: '2026-09-30T06:00:00+00:00' },
    e10: { price: 1.839, lastChange: '2026-09-30T06:00:00+00:00' },
    diesel: null,
  },
  isOpen: true,
  openingTimes: OPENING_TIMES,
  distance: 2475.4,
};

describe('toStationFromGermany', () => {
  it('maps a tankentanken station to a station', () => {
    expect(toStationFromGermany(tankenTankenStation)).toEqual({
      id: 'de-44444444-4444-4444-8444-444444444444',
      country: 'DE',
      name: 'Esso Kassel Süd',
      brand: 'Esso',
      address: {
        street: 'Frankfurter Straße',
        houseNumber: '210',
        postalCode: '34134',
        city: 'Kassel',
        latitude: 51.28,
        longitude: 9.46,
      },
      pricesInEuro: { e5: 1.899, e10: 1.839, superPlus: null, diesel: null, e85: null, lpg: null },
      isOpen: true,
      openingTimes: OPENING_TIMES,
      distanceInMeters: 2475,
    });
  });

  it('reports an unknown distance as null', () => {
    const { distance: _distance, ...detailStation } = tankenTankenStation;

    expect(toStationFromGermany(detailStation).distanceInMeters).toBeNull();
  });

  it('keeps a distance of zero meters', () => {
    expect(toStationFromGermany({ ...tankenTankenStation, distance: 0 }).distanceInMeters).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { upstreamStationSchema, upstreamStationsSchema } from './index.js';

const openingDay = [{ opening: '06:00', closing: '22:00' }];

const upstreamStation = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Freie Tankstelle am Bahnhof',
  brand: null,
  address: {
    street: 'Bahnhofstraße',
    houseNumber: '7',
    postalCode: '34117',
    city: 'Kassel',
    latitude: 51.318,
    longitude: 9.489,
  },
  fuelPrices: {
    e5: { price: 1.799, lastChange: '2026-09-30T08:00:00+00:00' },
    e10: null,
    diesel: { price: 1.629, lastChange: '2026-09-30T08:00:00+00:00' },
  },
  isOpen: true,
  openingTimes: {
    monday: openingDay,
    tuesday: openingDay,
    wednesday: openingDay,
    thursday: openingDay,
    friday: openingDay,
    saturday: openingDay,
    sunday: [],
    publicHoliday: [],
  },
  distance: 3120,
  publicHolidayIdentifier: null,
  mdmVersion: 1,
};

describe('upstreamStationSchema', () => {
  it('accepts a station without brand and with a missing fuel price', () => {
    const station = upstreamStationSchema.parse(upstreamStation);

    expect(station.brand).toBeNull();
    expect(station.fuelPrices.e10).toBeNull();
    expect(station.fuelPrices.e5?.price).toBe(1.799);
    expect(station.distance).toBe(3120);
  });

  it('accepts a station without distance, as returned by the detail endpoint', () => {
    const { distance: _distance, ...detailStation } = upstreamStation;

    expect(upstreamStationSchema.parse(detailStation).distance).toBeUndefined();
  });

  it('drops fields the app does not use', () => {
    expect(upstreamStationSchema.parse(upstreamStation)).not.toHaveProperty('mdmVersion');
  });

  it('rejects a station without coordinates', () => {
    const { latitude: _latitude, ...addressWithoutLatitude } = upstreamStation.address;

    expect(
      upstreamStationSchema.safeParse({ ...upstreamStation, address: addressWithoutLatitude })
        .success
    ).toBe(false);
  });

  it('parses a list response', () => {
    expect(upstreamStationsSchema.parse([upstreamStation, upstreamStation])).toHaveLength(2);
  });
});

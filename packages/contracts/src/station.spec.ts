import { describe, expect, it } from 'vitest';
import { countryCodeSchema, stationSchema, stationsSchema } from './index.js';

const openingDay = [{ opening: '06:00', closing: '22:00' }];

const station = {
  id: 'fr-92242003',
  country: 'FR',
  name: null,
  brand: null,
  address: {
    street: '12 Avenue Pierre Brossolette',
    houseNumber: null,
    postalCode: '92240',
    city: 'Malakoff',
    latitude: 48.821,
    longitude: 2.312,
  },
  pricesInEuro: { e5: null, e10: 1.99, superPlus: null, diesel: 2.25, e85: 0.909, lpg: null },
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
  distanceInMeters: 850,
};

describe('countryCodeSchema', () => {
  it('accepts France', () => {
    expect(countryCodeSchema.parse('FR')).toBe('FR');
  });

  it.each(['DE', 'AT'])('rejects the unsupported country %s', country => {
    expect(countryCodeSchema.safeParse(country).success).toBe(false);
  });
});

describe('stationSchema', () => {
  it('accepts a French station without name, brand and house number', () => {
    const parsed = stationSchema.parse(station);

    expect(parsed.name).toBeNull();
    expect(parsed.pricesInEuro.e85).toBe(0.909);
  });

  it('accepts a station without known distance or opening status', () => {
    const parsed = stationSchema.parse({ ...station, distanceInMeters: null, isOpen: null });

    expect(parsed.distanceInMeters).toBeNull();
    expect(parsed.isOpen).toBeNull();
  });

  it('requires a price entry for every fuel type', () => {
    const { lpg: _lpg, ...pricesWithoutLpg } = station.pricesInEuro;

    expect(stationSchema.safeParse({ ...station, pricesInEuro: pricesWithoutLpg }).success).toBe(
      false
    );
  });

  it('rejects a negative price', () => {
    expect(
      stationSchema.safeParse({ ...station, pricesInEuro: { ...station.pricesInEuro, e10: -1 } })
        .success
    ).toBe(false);
  });

  it('rejects address coordinates outside the valid range', () => {
    expect(
      stationSchema.safeParse({ ...station, address: { ...station.address, longitude: 181 } })
        .success
    ).toBe(false);
  });

  it('parses a list of stations', () => {
    expect(stationsSchema.parse([station])).toHaveLength(1);
  });

  it('converts to a JSON schema for the OpenAPI documentation', () => {
    const jsonSchema = stationSchema.toJSONSchema();

    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.required).toContain('pricesInEuro');
  });
});

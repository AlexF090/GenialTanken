import { describe, expect, it } from 'vitest';
import { apiErrorSchema, stationSchema, stationsSchema } from './index.js';

const openingDay = [{ opening: '06:00', closing: '22:00' }];

const station = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Aral Tankstelle Wilhelmshöhe',
  brand: 'Aral',
  address: {
    street: 'Wilhelmshöher Allee',
    houseNumber: '100',
    postalCode: '34119',
    city: 'Kassel',
    latitude: 51.315,
    longitude: 9.47,
  },
  pricesInEuro: { e5: 1.859, e10: null, diesel: 1.689 },
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

describe('stationSchema', () => {
  it('accepts a station with a missing price', () => {
    expect(stationSchema.parse(station).pricesInEuro.e10).toBeNull();
  });

  it('accepts a station without known distance', () => {
    expect(stationSchema.parse({ ...station, distanceInMeters: null }).distanceInMeters).toBeNull();
  });

  it('rejects a negative price', () => {
    expect(
      stationSchema.safeParse({ ...station, pricesInEuro: { e5: -1, e10: null, diesel: null } })
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

describe('apiErrorSchema', () => {
  it('accepts the error body returned by the API', () => {
    expect(
      apiErrorSchema.parse({ statusCode: 502, message: 'The fuel price service is unavailable.' })
    ).toEqual({ statusCode: 502, message: 'The fuel price service is unavailable.' });
  });
});

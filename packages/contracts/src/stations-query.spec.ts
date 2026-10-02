import { describe, expect, it } from 'vitest';
import { fuelTypeSchema, stationsQuerySchema } from './index.js';

describe('fuelTypeSchema', () => {
  it('accepts the three supported fuel types', () => {
    expect(fuelTypeSchema.parse('e5')).toBe('e5');
    expect(fuelTypeSchema.parse('e10')).toBe('e10');
    expect(fuelTypeSchema.parse('diesel')).toBe('diesel');
  });

  it('rejects unknown fuel types', () => {
    expect(fuelTypeSchema.safeParse('lpg').success).toBe(false);
  });
});

describe('stationsQuerySchema', () => {
  it('coerces query string values into numbers', () => {
    expect(
      stationsQuerySchema.parse({
        latitude: '51.3127',
        longitude: '9.4797',
        radiusInKilometers: '10',
        fuel: 'diesel',
      })
    ).toEqual({ latitude: 51.3127, longitude: 9.4797, radiusInKilometers: 10, fuel: 'diesel' });
  });

  it('defaults to a 5 km radius and E5 when they are omitted', () => {
    expect(stationsQuerySchema.parse({ latitude: '51.3', longitude: '9.4' })).toEqual({
      latitude: 51.3,
      longitude: 9.4,
      radiusInKilometers: 5,
      fuel: 'e5',
    });
  });

  it.each([
    ['a radius below 1 km', { radiusInKilometers: '0' }],
    ['a radius above 25 km', { radiusInKilometers: '26' }],
    ['a latitude outside -90..90', { latitude: '91' }],
    ['a longitude outside -180..180', { longitude: '-181' }],
    ['a non-numeric latitude', { latitude: 'north' }],
  ])('rejects %s', (_description, override) => {
    const query = { latitude: '51.3', longitude: '9.4', ...override };
    expect(stationsQuerySchema.safeParse(query).success).toBe(false);
  });

  it('rejects a missing position', () => {
    expect(stationsQuerySchema.safeParse({ fuel: 'e5' }).success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { placeSchema, placesQuerySchema } from './index.js';

describe('placesQuerySchema', () => {
  it('trims the query and coerces the limit', () => {
    expect(placesQuerySchema.parse({ query: '  Bastille ', limit: '4' })).toEqual({
      query: 'Bastille',
      limit: 4,
    });
  });

  it('defaults to six suggestions', () => {
    expect(placesQuerySchema.parse({ query: 'Lyon' })).toEqual({ query: 'Lyon', limit: 6 });
  });

  it.each([
    ['a query shorter than 3 characters after trimming', { query: ' ab ' }],
    ['a query longer than 100 characters', { query: 'a'.repeat(101) }],
    ['a limit of 0', { query: 'Paris', limit: '0' }],
    ['a limit above 10', { query: 'Paris', limit: '11' }],
    ['a fractional limit', { query: 'Paris', limit: '2.5' }],
  ])('rejects %s', (_description, query) => {
    expect(placesQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe('placeSchema', () => {
  const place = {
    id: 'N123',
    name: 'Place de la Bastille',
    description: '75011 Paris, Frankreich',
    country: 'FR',
    latitude: 48.8532,
    longitude: 2.3692,
  };

  it('accepts a place in a supported country', () => {
    expect(placeSchema.parse(place)).toEqual(place);
  });

  it('rejects a place in an unsupported country', () => {
    expect(placeSchema.safeParse({ ...place, country: 'IT' }).success).toBe(false);
  });

  it('rejects coordinates outside the valid range', () => {
    expect(placeSchema.safeParse({ ...place, latitude: 91 }).success).toBe(false);
  });
});
